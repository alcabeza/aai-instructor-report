// Content script injected into the AAI portal.
// Adds a "My AAI report" button to the Technical Instructor page, walks through the
// dashboard tabs, reads their tables, then hands the data to the extension, which
// opens the report. No data leaves the browser.
(() => {
  if (window.__aaiBilanLoaded) return;
  window.__aaiBilanLoaded = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const lower = (s) => norm(s).toLowerCase();

  async function waitFor(fn, timeout = 10000, step = 150) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { const v = fn(); if (v) return v; } catch (e) { /* retry */ }
      await sleep(step);
    }
    return null;
  }

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  // "Nov 25, 2026" or "Jul 9, 2029 12:00 AM" -> "2026-11-25"
  function toISO(s) {
    const m = norm(s).match(/^([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2}),\s*(\d{4})/);
    if (!m) return null;
    const mo = MONTHS[m[1].toLowerCase()];
    if (!mo) return null;
    return `${m[3]}-${String(mo).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  function num(s) {
    const t = norm(s).replace('%', '').replace(',', '.');
    if (!t) return null;
    const v = parseFloat(t);
    return Number.isFinite(v) ? v : null;
  }
  function pick(row, ...names) {
    for (const n of names) {
      const k = Object.keys(row).find((h) => lower(h) === lower(n));
      if (k !== undefined) return row[k];
    }
    return '';
  }

  const SUBTABS = ['Delivery CSAT', 'Progress', 'Schedule & Events', 'Approved Courses', 'Ramping Courses',
    'Certifications', 'Providers', 'Requests', 'Delivery Resources', 'DIGs & Self-Paced Enablements', 'Reviews'];

  const allTabs = () => [...document.querySelectorAll('[role=tab]')];
  const findTab = (name) => allTabs().find((t) => lower(t.innerText) === lower(name));
  const isInstructorPage = () => !!findTab('Delivery CSAT') && !!findTab('Certifications');
  const mainText = () => (document.querySelector('main') || document.body).innerText || '';

  function currentSubTab() {
    const t = allTabs().find((e) => e.getAttribute('aria-selected') === 'true' && SUBTABS.some((n) => lower(n) === lower(e.innerText)));
    return t ? norm(t.innerText) : null;
  }

  async function openTab(name) {
    const t = findTab(name);
    if (!t) throw new Error(`tab "${name}" not found`);
    if (t.getAttribute('aria-selected') !== 'true') t.click();
    await waitFor(() => t.getAttribute('aria-selected') === 'true', 8000);
    await waitFor(() => [...document.querySelectorAll('h1,h2,h3,h4')].some((h) => lower(h.innerText) === lower(name)), 8000);
    await sleep(500);
  }

  // Reads a whole grid, including rows the page only renders while scrolling (virtualised grid).
  async function readGrid(expectHeader) {
    const grid = await waitFor(() => [...document.querySelectorAll('[role=grid]')].find((g) =>
      [...g.querySelectorAll('[role=columnheader]')].some((h) => lower(h.innerText) === lower(expectHeader))), 10000);
    if (!grid) return { rows: [], expected: null };
    await waitFor(() => grid.querySelector('[role=gridcell]') || /no rows found/i.test(grid.innerText), 6000);
    await sleep(300);

    const headers = [...grid.querySelectorAll('[role=columnheader]')].map((h) => norm(h.innerText));
    const rows = new Map();
    const collect = () => {
      grid.querySelectorAll('[role=row]').forEach((r) => {
        const cells = [...r.querySelectorAll('[role=gridcell]')];
        if (!cells.length) return;
        const vals = cells.map((c) => norm(c.innerText));
        const filled = vals.filter(Boolean);
        if (!filled.length) return;
        if (filled.length === 1 && /^\d+\s+results?$/i.test(filled[0])) return; // grid footer
        const o = {};
        vals.forEach((v, i) => { o[headers[i] !== undefined ? headers[i] : 'col' + i] = v; });
        rows.set(r.getAttribute('aria-rowindex') || vals.join('|'), o);
      });
    };
    collect();

    const scroller = [grid, ...grid.querySelectorAll('*')].find((e) =>
      e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== 'visible');
    if (scroller) {
      const start = scroller.scrollTop;
      const step = Math.max(120, Math.floor(scroller.clientHeight * 0.6));
      for (let y = 0; y <= scroller.scrollHeight + step; y += step) {
        scroller.scrollTop = y;
        await sleep(130);
        collect();
      }
      scroller.scrollTop = start;
    }
    const m = (grid.innerText || '').match(/(\d+)\s+results?/i);
    return { rows: [...rows.values()], expected: m ? +m[1] : null };
  }

  function readProfile() {
    const lines = mainText().split('\n').map(norm).filter(Boolean);
    const after = (label) => { const i = lines.findIndex((l) => lower(l) === lower(label)); return i >= 0 ? lines[i + 1] || '' : ''; };
    const h = [...document.querySelectorAll('h4,h3,h2')].map((e) => norm(e.innerText)).find((t) => / - [A-Z]{2,5}$/.test(t)) || '';
    const statuses = {};
    document.querySelectorAll('main input[type=checkbox], input[type=checkbox]').forEach((cb) => {
      let p = cb;
      for (let i = 0; i < 6 && p && !norm(p.innerText); i++) p = p.parentElement;
      const label = p ? norm(p.innerText) : '';
      if (label && label.length < 40) statuses[label] = !!cb.checked;
    });
    return {
      name: h.replace(/ - [A-Z]{2,5}$/, ''),
      geo: after('Geo'),
      region: after('Region'),
      type: after('Type'),
      authorized: lines.some((l) => lower(l) === 'authorized'),
      statuses
    };
  }

  function readProgress() {
    const t = mainText();
    const block = (label) => {
      const re = new RegExp(label + ':?\\s*CSAT\\s*=\\s*([\\d.]+),\\s*from\\s*(\\d+)\\s*survey responses\\s*Survey Response Rate\\s*=\\s*([\\d.]+)%\\s*Delivery Days\\s*=\\s*([\\d.]+)', 'i');
      const m = t.replace(/\s+/g, ' ').match(re);
      return m ? { csat: +m[1], responses: +m[2], rate: +m[3], days: +m[4] } : null;
    };
    const badges = [];
    const re = /([A-Za-z][A-Za-z ]*? Badge):\s*\n([\s\S]*?)(?=\n[A-Za-z][A-Za-z ]*? Badge:|$)/g;
    let m;
    while ((m = re.exec(t))) {
      const items = m[2].split('\n').map(norm).filter(Boolean)
        .filter((l) => /^(✅|❌|⬜|☑|✔|✖|❎|🔲|-)/u.test(l))
        .map((l) => ({ done: /^(✅|☑|✔)/u.test(l), text: norm(l.replace(/^(\S+)\s*/u, '')) }));
      if (items.length) badges.push({ name: norm(m[1]), items, done: items.every((i) => i.done) });
    }
    return { ytd: block('Year to Date'), prev: block('Previous Year'), badges };
  }

  async function collectAll(onStep) {
    const original = currentSubTab();
    const warnings = [];
    const data = { version: 1, scrapedAt: new Date().toISOString(), source: location.origin, warnings };
    data.profile = readProfile();

    const step = async (tab, label, fn) => {
      onStep(label);
      try { await openTab(tab); await fn(); } catch (e) { warnings.push(`${tab}: ${e.message}`); }
    };
    const check = (tab, res) => {
      if (res.expected !== null && res.rows.length < res.expected) warnings.push(`${tab}: read ${res.rows.length} of ${res.expected} rows`);
    };

    await step('Delivery CSAT', 'Reading sessions…', async () => {
      const res = await readGrid('Instructor csat score');
      check('Delivery CSAT', res);
      data.sessions = res.rows.map((o) => ({
        course: pick(o, 'Course name'),
        endDate: toISO(pick(o, 'End date')),
        students: num(pick(o, 'Students attended')),
        csat: num(pick(o, 'Instructor csat score')),
        responseRate: num(pick(o, 'Survey Response Rate'))
      })).filter((s) => s.course && s.endDate);
    });
    await step('Progress', 'Reading indicators…', async () => {
      await waitFor(() => /Year to Date/i.test(mainText()), 6000);
      data.progress = readProgress();
    });
    await step('Approved Courses', 'Reading approved courses…', async () => {
      const res = await readGrid('Deliveries');
      check('Approved Courses', res);
      data.approved = res.rows.map((o) => ({
        course: pick(o, 'Course name'),
        days: num(pick(o, 'Days')),
        greenlit: toISO(pick(o, 'Greenlit')),
        firstDelivery: toISO(pick(o, 'First delivery')),
        lastDelivery: toISO(pick(o, 'Last delivery')),
        deliveries: num(pick(o, 'Deliveries')) || 0,
        domain: pick(o, 'Domain')
      })).filter((c) => c.course);
    });
    await step('Ramping Courses', 'Reading ramping courses…', async () => {
      const res = await readGrid('Course days');
      data.ramping = res.rows.map((o) => ({ course: pick(o, 'Course name'), days: num(pick(o, 'Course days')) })).filter((c) => c.course);
    });
    await step('Certifications', 'Reading certifications…', async () => {
      const res = await readGrid('Expiration Date');
      check('Certifications', res);
      data.certifications = res.rows.map((o) => ({
        name: pick(o, 'Certification'),
        expires: toISO(pick(o, 'Expiration Date')),
        expired: /yes|true|oui/i.test(pick(o, 'Expired'))
      })).filter((c) => c.name);
    });
    await step('Providers', 'Reading providers…', async () => {
      const res = await readGrid('Training Provider');
      data.providers = res.rows.map((o) => pick(o, 'Training Provider')).filter(Boolean);
    });

    if (original) { try { await openTab(original); } catch (e) { /* not critical */ } }
    return data;
  }

  // ---- Button ----
  let btn = null;
  let running = false;

  function setBtn(state, text) {
    if (!btn) return;
    btn.replaceChildren();
    btn.classList.toggle('is-error', state === 'error');
    btn.disabled = state === 'busy';
    if (state === 'busy') { const s = document.createElement('span'); s.className = 'aai-bilan-spin'; btn.appendChild(s); }
    btn.appendChild(document.createTextNode(text));
  }

  async function run() {
    if (running) return;
    if (!isInstructorPage()) {
      alert('Open your "Technical Instructor" page on the AAI portal first.');
      return;
    }
    running = true;
    try {
      const data = await collectAll((label) => setBtn('busy', label));
      if (!data.sessions || !data.sessions.length) throw new Error('no sessions read from the Delivery CSAT tab');
      setBtn('busy', 'Opening report…');
      await chrome.runtime.sendMessage({ type: 'aai-open', data });
      setBtn('idle', '📊 My AAI report');
    } catch (e) {
      console.error('[Bilan AAI]', e);
      setBtn('error', 'Failed: ' + e.message);
      setTimeout(() => setBtn('idle', '📊 My AAI report'), 6000);
    } finally {
      running = false;
    }
  }

  function ensureButton() {
    const show = isInstructorPage();
    if (show && !btn) {
      btn = document.createElement('button');
      btn.id = 'aai-bilan-btn';
      btn.type = 'button';
      btn.title = 'Reads your dashboard and opens a visual report in a new tab';
      btn.addEventListener('click', run);
      setBtn('idle', '📊 My AAI report');
      document.body.appendChild(btn);
    } else if (!show && btn && !running) {
      btn.remove();
      btn = null;
    }
  }

  setInterval(ensureButton, 1500);
  ensureButton();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'aai-run') run();
  });
})();

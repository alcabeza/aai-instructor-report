/* global d3, chrome */
// Report page: reads the data stored by the extension and draws the dashboard.
(() => {
  const $ = (id) => document.getElementById(id);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  const fInt = d3.format(',d');
  const fDec2 = d3.format('.2f');
  const signed = (f) => (v) => (v > 0 ? '+' : '') + f(v);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fDate = (iso) => { if (!iso) return '—'; const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
  const yearOf = (iso) => +String(iso).slice(0, 4);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  const SOON_DAYS = 183;        // "expires within 6 months"
  const CSAT_THRESHOLD = 4.75;  // minimum CSAT to remain an instructor
  const CSAT_FLOOR = 4.0;       // at or below this, the colour is fully red

  // Green at or above the threshold; below it, from orange (just under) to red (at the floor).
  function csatColor(v) {
    if (v === null || v === undefined || !Number.isFinite(+v)) return css('--muted');
    if (v >= CSAT_THRESHOLD) return css('--ok');
    const t = Math.max(0, Math.min(1, (CSAT_THRESHOLD - v) / (CSAT_THRESHOLD - CSAT_FLOOR)));
    return d3.interpolateRgb(css('--orange'), css('--bad'))(t);
  }

  let DATA = null;
  let YEAR = null;

  // ---------- Tooltip ----------
  function tooltip(box) {
    const tip = el('div', 'aai-tip'); tip.hidden = true; box.appendChild(tip);
    return {
      show(ev, title, rows) {
        tip.replaceChildren(el('div', null, title));
        tip.firstChild.style.fontWeight = '600';
        rows.forEach(([k, v]) => { const line = el('div'); line.append(el('span', 'k', k + ': '), document.createTextNode(v)); tip.appendChild(line); });
        tip.hidden = false;
        const b = box.getBoundingClientRect();
        const x = ev.clientX - b.left, y = ev.clientY - b.top;
        tip.style.left = Math.max(0, Math.min(b.width - tip.offsetWidth, x + 12)) + 'px';
        tip.style.top = Math.max(0, y - tip.offsetHeight - 10) + 'px';
      },
      hide() { tip.hidden = true; }
    };
  }
  const emptyMsg = (box, text) => box.replaceChildren(el('div', 'aai-empty', text));

  // ---------- Calculations ----------
  function sessionsOf(year) { return (DATA.sessions || []).filter((s) => yearOf(s.endDate) === year); }
  function stats(list) {
    const scored = list.filter((s) => s.csat !== null);
    return {
      sessions: list.length,
      students: list.reduce((a, s) => a + (s.students || 0), 0),
      scored: scored.length,
      csat: mean(scored.map((s) => s.csat))
    };
  }
  function certStatus() {
    const now = Date.now();
    return (DATA.certifications || [])
      .map((c) => ({ ...c, daysLeft: c.expires ? Math.ceil((Date.parse(c.expires + 'T00:00:00Z') - now) / 86400000) : null }))
      .sort((a, b) => (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9));
  }
  const isDiscovery = (c) => /^AWS Discovery Day/i.test(c.course);
  const plural = (n, one, many) => (n === 1 ? one : many);

  // ---------- Header ----------
  function renderHeader() {
    const p = DATA.profile || {};
    $('name').textContent = p.name || 'AAI Instructor';
    const provider = (DATA.providers || []).join(', ');
    $('role').textContent = ['AWS Technical Instructor (AAI)', provider, [p.geo, p.region].filter(Boolean).join(' / ')].filter(Boolean).join(' · ');
    const tags = $('tags'); tags.replaceChildren();
    Object.entries(p.statuses || {}).filter(([, on]) => on).forEach(([k]) => tags.appendChild(el('span', 'aai-tag is-star', '★ ' + k)));
    if (p.authorized) tags.appendChild(el('span', 'aai-tag', 'Authorized'));
    if (p.type) tags.appendChild(el('span', 'aai-tag', p.type));
    const badges = ((DATA.progress || {}).badges || []).filter((b) => b.done).map((b) => b.name.replace(/ Badge$/i, ''));
    if (badges.length) tags.appendChild(el('span', 'aai-tag', 'AI badges: ' + badges.join(' · ')));

    const w = $('warnings'); w.replaceChildren();
    (DATA.warnings || []).forEach((t) => w.appendChild(el('li', null, t)));
    w.hidden = !(DATA.warnings || []).length;

    const at = new Date(DATA.scrapedAt);
    const when = at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + ' at ' + at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    $('stamp').textContent = 'Data read on ' + when;
    $('foot').textContent = 'Source: AWS AAI portal instructor dashboard, read on ' + when + '. Learner counts and scores for the most recent sessions may not be available yet. CSAT threshold to remain an instructor: ' + fDec2(CSAT_THRESHOLD) + '.';
  }

  function officialFor(year) {
    const pr = DATA.progress || {};
    const cur = yearOf(DATA.scrapedAt);
    if (year === cur && pr.ytd) return { now: pr.ytd, prev: pr.prev, label: 'year to date' };
    if (year === cur - 1 && pr.prev) return { now: pr.prev, prev: null, label: 'full year' };
    return null;
  }

  function renderLede() {
    const s = stats(sessionsOf(YEAR));
    const off = officialFor(YEAR);
    const csat = off ? off.now.csat : s.csat;
    const soon = certStatus().filter((c) => c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= SOON_DAYS).length;
    const p = $('lede'); p.replaceChildren();
    const b = (t) => el('b', null, t);
    p.append(`In ${YEAR}: `, b(fInt(s.sessions)), ` ${plural(s.sessions, 'session', 'sessions')}, `, b(fInt(s.students)), ` ${plural(s.students, 'learner', 'learners')} trained`);
    if (csat !== null && csat !== undefined) {
      const c = b(fDec2(csat)); c.style.color = csatColor(csat);
      p.append(' and a CSAT of ', c, '/5');
    }
    p.append('. ');
    if (soon) p.append(b(fInt(soon)), ` ${plural(soon, 'certification expires', 'certifications expire')} within the next 6 months.`);
    else p.append('No certification expires within the next 6 months.');
  }

  // ---------- KPIs ----------
  function kpiCard({ label, value, unit, delta, fmt, deltaLabel, tol = 0, color, note }) {
    const c = el('div', 'aai-card');
    c.appendChild(el('div', 'aai-label', label));
    const big = el('div', 'aai-big', value);
    if (color) big.style.color = color;
    if (unit) big.appendChild(el('span', 'aai-unit', unit));
    c.appendChild(big);
    const d = el('div', 'aai-delta');
    if (delta !== null && delta !== undefined && Number.isFinite(delta)) {
      d.append(el('span', Math.abs(delta) <= tol ? 'aai-neutral' : delta > 0 ? 'aai-good' : 'aai-bad', fmt(delta)), ' ' + deltaLabel);
    } else if (deltaLabel) {
      d.textContent = deltaLabel;
    }
    c.appendChild(d);
    if (note) c.appendChild(el('div', 'aai-delta', note));
    return c;
  }

  function renderKpis() {
    const box = $('kpis'); box.replaceChildren();
    const s = stats(sessionsOf(YEAR));
    const p = stats(sessionsOf(YEAR - 1));
    const hasPrev = p.sessions > 0;
    const off = officialFor(YEAR);
    const vs = `vs ${YEAR - 1}`;
    const thr = `Threshold ${fDec2(CSAT_THRESHOLD)}`;
    $('kpi-title').textContent = off ? `${YEAR} indicators (${off.label})` + (off.prev ? ` vs ${YEAR - 1}` : '') : `${YEAR} indicators (computed from sessions)`;
    if (off) {
      const d = (k) => (off.prev ? Math.round((off.now[k] - off.prev[k]) * 100) / 100 : null);
      box.append(
        kpiCard({ label: 'Instructor CSAT', value: fDec2(off.now.csat), unit: ' /5', delta: d('csat'), fmt: signed(fDec2), deltaLabel: vs, tol: 0.05, color: csatColor(off.now.csat), note: thr }),
        kpiCard({ label: 'Survey responses', value: fInt(off.now.responses), delta: d('responses'), fmt: signed(fInt), deltaLabel: vs }),
        kpiCard({ label: 'Response rate', value: fInt(off.now.rate), unit: ' %', delta: d('rate'), fmt: signed(fInt), deltaLabel: 'pts ' + vs }),
        kpiCard({ label: 'Delivery days', value: fInt(off.now.days), delta: d('days'), fmt: signed(fInt), deltaLabel: vs })
      );
    } else {
      box.append(kpiCard({
        label: 'Average session CSAT', value: s.csat !== null ? fDec2(s.csat) : '—', unit: ' /5',
        delta: hasPrev && s.csat !== null && p.csat !== null ? s.csat - p.csat : null, fmt: signed(fDec2), deltaLabel: vs, tol: 0.05,
        color: s.csat !== null ? csatColor(s.csat) : null, note: thr
      }));
    }
    box.append(
      kpiCard({ label: 'Sessions delivered', value: fInt(s.sessions), delta: hasPrev ? s.sessions - p.sessions : null, fmt: signed(fInt), deltaLabel: hasPrev ? vs : `${fInt(s.scored)} with a CSAT score` }),
      kpiCard({ label: 'Learners trained', value: fInt(s.students), delta: hasPrev ? s.students - p.students : null, fmt: signed(fInt), deltaLabel: hasPrev ? vs : '' })
    );
  }

  // ---------- Charts ----------
  function chartMonthly() {
    const box = $('chart-monthly'); box.replaceChildren();
    const list = sessionsOf(YEAR);
    if (!list.length) return emptyMsg(box, 'No sessions this year.');
    const rows = d3.range(12).map((i) => {
      const rs = list.filter((s) => +s.endDate.slice(5, 7) === i + 1);
      return { m: i, sessions: rs.length, students: rs.reduce((a, s) => a + (s.students || 0), 0) };
    });
    const W = box.clientWidth || 600, H = 240, mg = { t: 22, r: 4, b: 26, l: 4 };
    const x = d3.scaleBand().domain(d3.range(12)).range([mg.l, W - mg.r]).padding(0.28);
    const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.sessions) || 1]).range([H - mg.b, mg.t]);
    const svg = d3.select(box).append('svg').attr('width', W).attr('height', H).attr('role', 'img').attr('aria-label', `Sessions per month in ${YEAR}`);
    svg.append('line').attr('x1', mg.l).attr('x2', W - mg.r).attr('y1', H - mg.b).attr('y2', H - mg.b).style('stroke', css('--line'));
    const tip = tooltip(box);
    const g = svg.selectAll('g').data(rows).join('g');
    g.append('rect').attr('x', (r) => x(r.m)).attr('width', x.bandwidth()).attr('y', (r) => y(r.sessions)).attr('height', (r) => y(0) - y(r.sessions)).attr('rx', 3).style('fill', css('--series'));
    g.filter((r) => r.sessions > 0).append('text').attr('class', 'is-strong').attr('text-anchor', 'middle').attr('x', (r) => x(r.m) + x.bandwidth() / 2).attr('y', (r) => y(r.sessions) - 6).text((r) => r.sessions);
    g.append('text').attr('text-anchor', 'middle').attr('x', (r) => x(r.m) + x.bandwidth() / 2).attr('y', H - 8).text((r) => (W < 460 ? MONTHS[r.m][0] : MONTHS[r.m]));
    g.append('rect').attr('x', (r) => x(r.m) - (x.step() - x.bandwidth()) / 2).attr('width', x.step()).attr('y', mg.t).attr('height', H - mg.t - mg.b).style('fill', 'transparent')
      .on('pointermove', (ev, r) => tip.show(ev, `${MONTHS[r.m]} ${YEAR}`, [['Sessions', String(r.sessions)], ['Learners', String(r.students)]]))
      .on('pointerleave', () => tip.hide());
  }

  function chartDots() {
    const box = $('chart-dots'); box.replaceChildren();
    const rows = sessionsOf(YEAR).filter((s) => s.csat !== null).map((s) => ({ ...s, t: Date.parse(s.endDate + 'T00:00:00Z') }));
    if (!rows.length) return emptyMsg(box, 'No rated sessions this year.');
    const W = box.clientWidth || 600, H = 250, mg = { t: 14, r: 12, b: 26, l: 34 };
    const minC = Math.min(3.9, d3.min(rows, (r) => r.csat) - 0.1);
    const x = d3.scaleUtc().domain([Date.UTC(YEAR, 0, 1), Date.UTC(YEAR, 11, 31)]).range([mg.l, W - mg.r]);
    const y = d3.scaleLinear().domain([minC, 5.08]).range([H - mg.b, mg.t]);
    const r = d3.scaleSqrt().domain([0, d3.max(rows, (q) => q.students || 0) || 1]).range([3, 10]);
    const svg = d3.select(box).append('svg').attr('width', W).attr('height', H).attr('role', 'img')
      .attr('aria-label', `CSAT score of each rated session in ${YEAR}, with the ${fDec2(CSAT_THRESHOLD)} threshold`);

    // zone under the threshold
    svg.append('rect').attr('x', mg.l).attr('width', W - mg.l - mg.r).attr('y', y(CSAT_THRESHOLD)).attr('height', y(minC) - y(CSAT_THRESHOLD))
      .style('fill', css('--bad')).style('fill-opacity', 0.06);
    y.ticks(4).filter((v) => v >= minC && Math.abs(v - CSAT_THRESHOLD) > 0.08).forEach((v) => {
      svg.append('line').attr('x1', mg.l).attr('x2', W - mg.r).attr('y1', y(v)).attr('y2', y(v)).style('stroke', css('--grid'));
      svg.append('text').attr('x', mg.l - 6).attr('y', y(v) + 4).attr('text-anchor', 'end').text(d3.format('.1f')(v));
    });
    // threshold line
    svg.append('line').attr('x1', mg.l).attr('x2', W - mg.r).attr('y1', y(CSAT_THRESHOLD)).attr('y2', y(CSAT_THRESHOLD))
      .style('stroke', css('--bad')).style('stroke-width', 1.5).style('stroke-dasharray', '5 4');
    svg.append('text').attr('x', mg.l - 6).attr('y', y(CSAT_THRESHOLD) + 4).attr('text-anchor', 'end').attr('class', 'is-threshold').text(fDec2(CSAT_THRESHOLD));

    d3.utcMonth.range(new Date(Date.UTC(YEAR, 0, 1)), new Date(Date.UTC(YEAR + 1, 0, 1)), W < 460 ? 3 : 2)
      .forEach((t) => svg.append('text').attr('x', x(t)).attr('y', H - 8).text(MONTHS[t.getUTCMonth()]));
    const tip = tooltip(box);
    svg.selectAll('circle').data(rows).join('circle')
      .attr('cx', (q) => x(q.t)).attr('cy', (q) => y(q.csat)).attr('r', (q) => r(q.students || 0))
      .style('fill', (q) => csatColor(q.csat)).style('fill-opacity', 0.8)
      .style('stroke', css('--panel')).style('stroke-width', 1)
      .on('pointermove', (ev, q) => tip.show(ev, q.course, [['End', fDate(q.endDate)], ['CSAT', fDec2(q.csat) + (q.csat < CSAT_THRESHOLD ? ' (below threshold)' : '')], ['Learners', q.students ? String(q.students) : 'n/a'], ['Response rate', q.responseRate !== null ? q.responseRate + ' %' : 'n/a']]))
      .on('pointerleave', () => tip.hide());
    // threshold caption drawn last, with a halo, so dots never hide it
    svg.append('text').attr('x', W - mg.r - 4).attr('y', y(CSAT_THRESHOLD) - 6).attr('text-anchor', 'end').attr('class', 'is-threshold is-halo')
      .text(W < 460 ? 'Instructor threshold' : 'Minimum to remain instructor');
  }

  const shortName = (s) => String(s).replace(/\s*\(formerly[^)]*\)/i, '');
  function fitText(sel, max) {
    sel.each(function () {
      let s = this.textContent;
      while (this.getComputedTextLength() > max && s.length > 8) { s = s.slice(0, -2); this.textContent = s + '…'; }
    });
  }

  function chartCourses() {
    const box = $('chart-courses'); box.replaceChildren();
    $('courses-title').textContent = `Courses delivered in ${YEAR}`;
    const g0 = d3.group(sessionsOf(YEAR), (s) => s.course);
    const rows = [...g0].map(([course, ss]) => ({ course, ...stats(ss) })).sort((a, b) => b.sessions - a.sessions || b.students - a.students);
    if (!rows.length) return emptyMsg(box, 'No sessions this year.');
    const W = box.clientWidth || 600, rowH = 40;
    const H = rows.length * rowH + 4;
    const x = d3.scaleLinear().domain([0, d3.max(rows, (q) => q.sessions)]).range([0, W]);
    const svg = d3.select(box).append('svg').attr('width', W).attr('height', H).attr('role', 'img').attr('aria-label', `Sessions per course in ${YEAR}`);
    const tip = tooltip(box);
    const g = svg.selectAll('g').data(rows).join('g').attr('transform', (q, i) => `translate(0,${i * rowH + 2})`);
    const names = g.append('text').attr('class', 'is-strong').attr('y', 13).text((q) => shortName(q.course));
    const right = g.append('text').attr('x', W).attr('y', 13).attr('text-anchor', 'end');
    right.append('tspan').text((q) => `${q.sessions} ${plural(q.sessions, 'session', 'sessions')} · `);
    right.append('tspan').style('fill', (q) => csatColor(q.csat)).style('font-weight', 600).text((q) => (q.csat !== null ? 'CSAT ' + fDec2(q.csat) : 'no score'));
    g.append('rect').attr('y', 19).attr('height', 10).attr('rx', 3).attr('width', W).style('fill', css('--grid'));
    g.append('rect').attr('y', 19).attr('height', 10).attr('rx', 3).attr('width', (q) => Math.max(2, x(q.sessions))).style('fill', (q) => csatColor(q.csat));
    g.append('rect').attr('width', W).attr('height', rowH).style('fill', 'transparent')
      .on('pointermove', (ev, q) => tip.show(ev, shortName(q.course), [['Sessions', String(q.sessions)], ['Learners', String(q.students)], ['Average CSAT', q.csat !== null ? fDec2(q.csat) : 'n/a']]))
      .on('pointerleave', () => tip.hide());
    fitText(names, W * 0.58);
  }

  function chartYears() {
    const box = $('chart-years'); box.replaceChildren();
    const g0 = d3.group(DATA.sessions || [], (s) => yearOf(s.endDate));
    const rows = [...g0].map(([y, ss]) => ({ y, ...stats(ss) })).sort((a, b) => a.y - b.y);
    if (!rows.length) return emptyMsg(box, 'No sessions.');
    const W = box.clientWidth || 600, H = 240, mg = { t: 22, r: 4, b: 26, l: 4 };
    const x = d3.scaleBand().domain(rows.map((r) => r.y)).range([mg.l, W - mg.r]).padding(0.35);
    const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.sessions)]).range([H - mg.b, mg.t]);
    const svg = d3.select(box).append('svg').attr('width', W).attr('height', H).attr('role', 'img').attr('aria-label', 'Sessions per year');
    svg.append('line').attr('x1', mg.l).attr('x2', W - mg.r).attr('y1', H - mg.b).attr('y2', H - mg.b).style('stroke', css('--line'));
    const tip = tooltip(box);
    const g = svg.selectAll('g').data(rows).join('g');
    g.append('rect').attr('x', (r) => x(r.y)).attr('width', x.bandwidth()).attr('y', (r) => y(r.sessions)).attr('height', (r) => y(0) - y(r.sessions)).attr('rx', 3)
      .style('fill', (r) => (r.y === YEAR ? css('--accent') : css('--series')));
    g.append('text').attr('class', 'is-strong').attr('text-anchor', 'middle').attr('x', (r) => x(r.y) + x.bandwidth() / 2).attr('y', (r) => y(r.sessions) - 6).text((r) => r.sessions);
    g.append('text').attr('text-anchor', 'middle').attr('x', (r) => x(r.y) + x.bandwidth() / 2).attr('y', H - 8).text((r) => r.y);
    g.append('rect').attr('x', (r) => x(r.y) - (x.step() - x.bandwidth()) / 2).attr('width', x.step()).attr('y', mg.t).attr('height', H - mg.t - mg.b).style('fill', 'transparent')
      .on('pointermove', (ev, r) => tip.show(ev, String(r.y), [['Sessions', String(r.sessions)], ['Learners', fInt(r.students)], ['Average CSAT', r.csat !== null ? fDec2(r.csat) + ` (${r.scored} rated)` : 'no score']]))
      .on('pointerleave', () => tip.hide());
  }

  // ---------- Tables ----------
  function renderCerts() {
    const tb = $('certs'); tb.replaceChildren();
    const list = certStatus();
    if (!list.length) { const tr = el('tr'); const td = el('td', null, 'No certifications found.'); td.colSpan = 3; tr.appendChild(td); tb.appendChild(tr); return; }
    list.forEach((c) => {
      const tr = el('tr');
      tr.appendChild(el('td', null, c.name.replace(/^AWS Certified /, '')));
      tr.appendChild(el('td', 'is-date', fDate(c.expires)));
      const td = el('td', 'aai-num');
      const pill = el('span', 'aai-pill', c.daysLeft === null ? '—' : c.daysLeft < 0 ? 'expired' : fInt(c.daysLeft));
      pill.style.color = c.daysLeft !== null && c.daysLeft <= SOON_DAYS ? css('--warn') : css('--muted');
      td.appendChild(pill); tr.appendChild(td); tb.appendChild(tr);
    });
  }

  function renderBadges() {
    const box = $('badges'); box.replaceChildren();
    const list = (DATA.progress || {}).badges || [];
    if (!list.length) return box.appendChild(el('div', 'aai-empty', 'No badges found in the Progress tab.'));
    list.forEach((b) => {
      const row = el('div', 'aai-badge');
      row.appendChild(el('span', 'mark ' + (b.done ? 'is-done' : 'is-todo'), b.done ? '✓' : '○'));
      const txt = el('div');
      const left = b.items.filter((i) => !i.done).length;
      txt.appendChild(el('strong', null, b.name.replace(/ Badge$/i, '') + (b.done ? '' : ` — ${left} ${plural(left, 'prerequisite', 'prerequisites')} left`)));
      txt.appendChild(el('span', 'items', b.items.map((i) => (i.done ? '' : '○ ') + i.text.replace(/^(Certification|Course|Badge):\s*/i, '')).join(' · ')));
      row.appendChild(txt); box.appendChild(row);
    });
  }

  function renderCatalog() {
    const all = DATA.approved || [];
    const main = all.filter((c) => !isDiscovery(c));
    const disc = all.length - main.length;
    const delivered = main.filter((c) => c.deliveries > 0).length;
    const never = main.filter((c) => !(c.deliveries > 0));
    $('catalog-sub').textContent = `${fInt(main.length)} approved courses` + (disc ? ` (excluding ${fInt(disc)} "Discovery Day" ${plural(disc, 'format', 'formats')})` : '') + '. The most recent approvals are still to be delivered for the first time.';

    const box = $('chart-split'); box.replaceChildren();
    if (main.length) {
      const W = box.clientWidth || 600, H = 56, total = main.length;
      const svg = d3.select(box).append('svg').attr('width', W).attr('height', H).attr('role', 'img').attr('aria-label', `${delivered} courses already delivered, ${never.length} never delivered`);
      const w1 = (W * delivered) / total;
      svg.append('rect').attr('y', 24).attr('width', w1).attr('height', 14).attr('rx', 3).style('fill', css('--series'));
      svg.append('rect').attr('x', w1 + 2).attr('y', 24).attr('width', Math.max(0, W - w1 - 2)).attr('height', 14).attr('rx', 3).style('fill', css('--grid'));
      svg.append('text').attr('class', 'is-strong').attr('y', 14).text(`${delivered} already delivered`);
      svg.append('text').attr('class', 'is-strong').attr('x', W).attr('y', 14).attr('text-anchor', 'end').text(`${never.length} never delivered`);
    }
    const tb = $('never'); tb.replaceChildren();
    never.sort((a, b) => String(b.greenlit || '').localeCompare(String(a.greenlit || ''))).forEach((c) => {
      const tr = el('tr');
      tr.appendChild(el('td', null, c.course));
      tr.appendChild(el('td', 'aai-num', fDate(c.greenlit)));
      tb.appendChild(tr);
    });
    if (!never.length) { const tr = el('tr'); const td = el('td', null, 'Every approved course has been delivered at least once.'); td.colSpan = 2; tr.appendChild(td); tb.appendChild(tr); }
  }

  // ---------- Assembly ----------
  function drawCharts() { chartMonthly(); chartDots(); chartCourses(); chartYears(); renderCatalog(); }
  function render() { renderLede(); renderKpis(); renderCerts(); renderBadges(); drawCharts(); }
  const setTitle = () => { document.title = `AAI Report ${YEAR} — ${(DATA.profile || {}).name || ''}`; };

  function init(data) {
    DATA = data;
    if (!DATA || !(DATA.sessions || []).length) { $('empty').hidden = false; return; }
    $('content').hidden = false;
    const years = [...new Set(DATA.sessions.map((s) => yearOf(s.endDate)))].sort((a, b) => b - a);
    const cur = yearOf(DATA.scrapedAt);
    YEAR = years.includes(cur) ? cur : years[0];
    const sel = $('year');
    years.forEach((y) => sel.appendChild(new Option(String(y), String(y))));
    sel.value = String(YEAR);
    sel.addEventListener('change', () => { YEAR = +sel.value; setTitle(); render(); });
    setTitle();
    renderHeader();
    render();
    let t = null;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(drawCharts, 150); });
    window.addEventListener('beforeprint', drawCharts);
    window.addEventListener('afterprint', drawCharts);
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
  }

  $('btn-print').addEventListener('click', () => window.print());
  $('btn-json').addEventListener('click', () => {
    if (!DATA) return;
    const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aai-report-${(DATA.profile && DATA.profile.name || 'instructor').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${DATA.scrapedAt.slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  chrome.storage.local.get('aaiData').then(({ aaiData }) => init(aaiData));
})();

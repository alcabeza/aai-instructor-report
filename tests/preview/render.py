"""Renders the preview page at desktop and mobile widths and fails on any page error.
Usage: python3 tests/preview/render.py [--out docs/images]
Requires: pip install playwright && playwright install chromium (or a local Chrome)."""
import argparse, shutil, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

here = Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
ap.add_argument("--out", default=str(here / "out"))
args = ap.parse_args()
out = Path(args.out); out.mkdir(parents=True, exist_ok=True)

chrome = shutil.which("google-chrome") or shutil.which("chromium")
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=chrome) if chrome else p.chromium.launch()
    for width, name in ((1280, "report-desktop"), (420, "report-mobile")):
        page = browser.new_page(viewport={"width": width, "height": 900})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto((here / "preview.html").as_uri())
        page.wait_for_timeout(800)
        page.screenshot(path=str(out / f"{name}.png"), full_page=True)
        print("saved", out / f"{name}.png")
    browser.close()

if errors:
    print("Page errors:", *errors, sep="\n  ")
    sys.exit(1)
print("OK: no page errors")

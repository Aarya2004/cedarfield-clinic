"""In-image proof that headless Chromium launches as the non-root judge user and can load a page.
Run by smoke-image-rokan.sh via `docker exec -i ... python3 -`; prints `PROBE_OK <title> <ms>` on success.
Uses the same flags rokan's daemon will use in the container (no-sandbox, no dev-shm, no gpu)."""
import os, sys, time
from playwright.sync_api import sync_playwright

args = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
t0 = time.monotonic()
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=args)
        pg = b.new_page()
        pg.goto("https://example.org", timeout=30000)
        title = pg.title()
        b.close()
except Exception as e:  # noqa: BLE001 — the smoke wants the reason on one line
    print(f"PROBE_FAIL {type(e).__name__}: {str(e).splitlines()[0][:200]}")
    sys.exit(1)
print(f"PROBE_OK {title!r} {int((time.monotonic()-t0)*1000)}ms uid={os.getuid()}")

import asyncio, json, sys, time
from playwright.async_api import async_playwright

URLS = sys.argv[1:] or ["https://template.vercel.shop/"]

async def probe(url, channel):
    async with async_playwright() as p:
        kw = dict(headless=True, args=["--enable-features=WebMCP"])
        if channel: kw["channel"] = channel
        try:
            b = await p.chromium.launch(**kw)
        except Exception as e:
            return {"url": url, "channel": channel, "launch_error": str(e)[:160]}
        ver = b.version
        ctx = await b.new_context()
        page = await ctx.new_page()
        cdp = await ctx.new_cdp_session(page)
        tools = []
        cdp.on("WebMCP.toolsAdded", lambda ev: tools.extend(ev.get("tools", [])))
        t0 = time.time()
        try:
            await cdp.send("WebMCP.enable")
            enable = "ok"
        except Exception as e:
            enable = f"err: {str(e)[:120]}"
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)
        except Exception as e:
            enable += f" | goto: {str(e)[:100]}"
        has_mc = await page.evaluate("() => ({doc: !!document.modelContext, nav: !!navigator.modelContext, testing: !!navigator.modelContextTesting})")
        listed = None
        try:
            listed = await page.evaluate("() => navigator.modelContextTesting ? navigator.modelContextTesting.listTools().map(t=>t.name) : null")
        except Exception as e:
            listed = f"err {str(e)[:80]}"
        await b.close()
        return {"url": url, "channel": channel or "bundled", "chromium": ver, "enable": enable,
                "cdp_tools": [t.get("name") for t in tools], "page_api": has_mc, "testing_list": listed,
                "ms": int((time.time()-t0)*1000)}

async def main():
    for url in URLS:
        for ch in ("chrome",):
            r = await probe(url, ch)
            print(json.dumps(r))

asyncio.run(main())

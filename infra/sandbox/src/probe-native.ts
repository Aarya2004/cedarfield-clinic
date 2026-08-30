// Generated from evals/diagnostics/native-invoke-probe.py — served at /probe/native-invoke.py so a judge
// shell can `curl … | python3 -` it (the entry repo is private; raw.githubusercontent is not reachable).
export const NATIVE_PROBE_PY = String.raw`"""Tier 0 native probe — list a store's declared WebMCP tools and invoke ONE read tool directly
(no planner, 0 model calls), printing the raw result so a decline can be read, not guessed.

Run inside the judge sandbox (or any rokan-do install):
    python3 native-invoke-probe.py [site] [url] [tool] [query]
Defaults: allbirds.com / https://www.allbirds.com/ / search_catalog / "wool runners".
"""
import asyncio
import json
import sys
import time

from rokan_do import native

SITE = sys.argv[1] if len(sys.argv) > 1 else "allbirds.com"
URL = sys.argv[2] if len(sys.argv) > 2 else "https://www.allbirds.com/"
TOOL = sys.argv[3] if len(sys.argv) > 3 else "search_catalog"
QUERY = sys.argv[4] if len(sys.argv) > 4 else "wool runners"


async def main() -> int:
    t0 = time.monotonic()
    try:
        tools = await native.list_tools(SITE, URL)
    except Exception as exc:  # noqa: BLE001 — the point is to print it
        print(json.dumps({"step": "list", "ok": False, "error": f"{type(exc).__name__}: {exc}"[:400]}))
        return 1
    list_ms = int((time.monotonic() - t0) * 1000)
    print(json.dumps({"step": "list", "ok": True, "ms": list_ms,
                      "tools": [[t.name, bool(t.auto_invokable)] for t in tools]}))
    meta = next((t for t in tools if t.name == TOOL), None)
    if meta is None:
        print(json.dumps({"step": "invoke", "ok": False, "error": f"{TOOL} not declared"}))
        return 1
    t1 = time.monotonic()
    r = await native.invoke(SITE, URL, TOOL, {"catalog": {"query": QUERY}}, require_read=True, tool_meta=meta)
    print(json.dumps({"step": "invoke", "ok": r.ok, "is_error": r.is_error, "ms": int((time.monotonic() - t1) * 1000),
                      "elapsed_ms": r.elapsed_ms, "value": r.value[:500],
                      "raw": json.dumps(r.raw, default=str)[:600] if r.raw is not None else None}))
    return 0 if r.ok else 2


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
`;

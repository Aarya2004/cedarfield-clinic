---
name: rokan-do
description: Browse once. Verified, or refused. A local browsing tool for agents — behind the user's logins, memory that replays with zero model calls, a label on every result.
version: 0.0.1
license: Apache-2.0
---

# rokan-do — verified web operations for agents

You (the agent) get five tools over MCP. Use them instead of driving a browser
step by step.

## Install (the human runs this once)

```
claude mcp add --scope user rokan -- uvx rokan-do mcp      # Claude Code
codex mcp add rokan -- uvx rokan-do mcp                     # Codex
hermes skills install <this file's URL>                     # Hermes
clawhub install rokan                                       # OpenClaw
```

Then, in a terminal, the human consents once:

```
rokan-do "read the default keepalive_timeout at nginx.org"   # first-run disclosure
rokan-do allow-agents                                        # let agents call it
rokan save-login <site>                                      # optional: a login, kept in the OS keychain
```

## The tools

| tool                                               | what                                                                              | model calls                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------- |
| `rokan_browse(task, allow_write=false, params={})` | any task on a named site; result labeled `verified` / `self_reported` / `refused` | 1 first time, **0 on repeat** |
| `rokan_page(url)`                                  | the page as the user's browser sees it — text + value lines, redacted             | 0                             |
| `rokan_do(task)`                                   | a read with a typed proof (`get my api key…`, `what is my usage…`)                | 1 first time, 0 on repeat     |
| `rokan_do_ops()`                                   | what is warm — operations that replay instantly                                   | 0                             |
| `rokan_do_can()`                                   | the read classes accepted                                                         | 0                             |

## How to use it well

- **Name the site in the task.** `"cancel my plan at notion.so"`, not `"cancel notion"`.
- **Read the label, not the status.** `verified` means a deterministic check on
  the final page passed. `self_reported` means the run finished and nothing on
  the page could confirm it — treat as unknown. `refused` carries `reason` and
  `next_step`: follow `next_step`, do not retry the same call.
- **Writes need a human's word.** Anything that deletes, pays, cancels, sends or
  submits is refused until the human runs `rokan-do allow <site> <action>` in
  their own terminal AND you pass `allow_write=true`. You cannot grant it.
- **Values go in `params`, never in the task text.** `params={"recipient": "Ada",
"message": "…"}` — the plan binds them at fill time; one verified operation
  then replays for every value, with 0 model calls. Never a password.
- **Repeat freely.** A task that worked once replays without a model and is
  re-verified every time. Your second call is the cheap one.
- **It never solves bot checks, never creates accounts on its own, never
  accepts a credential in a task.** Each is reported honestly.

## Example

```
rokan_browse("what is the current status at www.githubstatus.com")
→ {"status":"ok","speed":"planned","verification":"verified","value":"All Systems Operational", …}
rokan_browse("what is the current status at www.githubstatus.com")
→ {"status":"ok","speed":"replayed","verification":"verified","elapsed_ms":140, …}
rokan_browse("cancel my subscription at notion.so", allow_write=true)
→ {"status":"abstained","verification":"refused","reason":"needs_approval",
   "next_step":"A person must grant this once, in their own terminal: rokan-do allow notion.so cancel"}
```

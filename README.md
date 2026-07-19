# DeepSeek Models for GitHub Copilot Chat

Bring **DeepSeek V4-Pro** and **DeepSeek V4-Flash** (1M context, selectable thinking effort) into GitHub Copilot Chat — with visible chain-of-thought, tool calling, and a live account-balance status bar.

![demo](https://api-docs.deepseek.com/img/v4-benchmark.png)

## Highlights

- 🧠 **Selectable thinking effort** — every model exposes a **None / High / Max** selector in the Copilot Chat model picker. DeepSeek's `reasoning_content` is forwarded to VS Code's thinking UI.
- 🚀 **Two flagship models** — `deepseek-v4-pro` (1.6T MoE, 49B active) and `deepseek-v4-flash` (284B MoE, 13B active). Both ship a 1M context window and 384K max output.
- 🛠️ **Full Copilot Chat integration** — tool calling, multi-turn reasoning preservation (passes `reasoning_content` back across tool-call turns to avoid the 400), and proper `tool_choice` handling.
- 🔐 **Bring-your-own-key** — your key lives in VS Code's SecretStorage (the OS keychain). Never written to `settings.json` or Git.
- 💰 **Live account balance** — a status-bar item polls `GET /user/balance` and surfaces your remaining credit; turns red when `is_available: false`.
- 🌐 **Single endpoint** — DeepSeek exposes one global base URL (`https://api.deepseek.com`); no region/apiMode gymnastics needed.

## Quick start

1. Install the extension.
2. Create a key at <https://platform.deepseek.com/api_keys>.
3. Run **DeepSeek: Set API Key** from the Command Palette and paste the key.
4. Open Copilot Chat, click the model picker, and pick **DeepSeek V4-Pro** or **DeepSeek V4-Flash**.
5. (Optional) Use the per-model **Thinking Effort** selector to choose `None`, `High`, or `Max`.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `deepseek-copilot.baseUrl` | `""` | Override the DeepSeek API base URL (empty = official endpoint). |
| `deepseek-copilot.maxTokens` | `0` | Max output tokens per request (`0` = API default). |
| `deepseek-copilot.maxRetries` | `3` | Auto retries on HTTP 429 / 5xx (exponential backoff + `Retry-After`). |
| `deepseek-copilot.modelIdOverrides` | `{}` | Remap picker model ids to API model ids. |
| `deepseek-copilot.customModels` | `[]` | Add your own model entries to the picker. |
| `deepseek-copilot.debugLogging` | `false` | Verbose logs to the DeepSeek output channel. |
| `deepseek-copilot.showUsageStatusBar` | `true` | Show the balance status bar. |
| `deepseek-copilot.usageRefreshIntervalMinutes` | `5` | Refresh interval for the balance status bar (1–1440). |

## Commands

| Command | Description |
| --- | --- |
| `DeepSeek: Set API Key` | Save your DeepSeek key to SecretStorage. |
| `DeepSeek: Get API Key` | Open platform.deepseek.com/api_keys. |
| `DeepSeek: Clear API Key` | Remove the stored key. |
| `DeepSeek: Open Settings` | Jump to the extension's settings. |
| `DeepSeek: Show Logs` | Reveal the DeepSeek output channel. |
| `DeepSeek: Refresh Usage` | Force-refresh the balance status bar. |
| `DeepSeek: Show Usage Details` | Open the balance detail webview. |

## How thinking effort works

| Picker value | Wire body |
| --- | --- |
| **None** | `thinking: { type: "disabled" }` |
| **High** | `thinking: { type: "enabled" }, reasoning_effort: "high"` |
| **Max** | `thinking: { type: "enabled" }, reasoning_effort: "max"` |

DeepSeek's default is **High**. Picking **Max** is recommended for hard coding and agentic tasks
(as Claude Code and OpenCode do automatically). **None** skips the chain-of-thought entirely for
the fastest, cheapest responses.

See [docs/deepseek-api.md](docs/deepseek-api.md) for the full API reference.

## Development

```bash
pnpm install
pnpm run compile      # build to out/
pnpm run watch        # rebuild on save
pnpm run typecheck    # tsc --noEmit
pnpm run lint         # eslint
pnpm test             # vitest run
pnpm run package      # produce a .vsix in dist/
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host with the extension loaded.

## License

MIT

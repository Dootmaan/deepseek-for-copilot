# Change Log

All notable changes to the **Deepseek Family for Github Copilot Chat** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] - 2026-10-15

### Changed

- Aligned the language model provider contribution with the latest Copilot Chat conventions: the DeepSeek entry in the model picker's provider list now exposes a manage-models action through `managementCommand`, opening the extension settings directly from Copilot Chat.
- Confirmed compatibility with VS Code 1.141 Copilot Chat model picker behavior, including the thinking-effort picker and per-model configuration schema.

## [1.0.3] - 2026-09-10

### Added

- Added the new official `deepseek-flash` model as a built-in picker entry, displayed as **DeepSeek V4.1 Flash**.
- Added native image-input support for `deepseek-flash` in Copilot Chat by serializing image attachments into DeepSeek's official Chat Completions content-block format.
- Added a local benchmark comparison SVG for the README, based on the V4.1 Flash release comparison chart.

### Changed

- Updated the built-in model lineup to the current public DeepSeek API surface: `deepseek-flash` plus `deepseek-v4-pro`.
- Restored the official **None / Low / High / Max** thinking-effort choices in the picker.
- Updated README, walkthroughs, API docs, metadata, and examples to use current DeepSeek model ids and routing behavior.
- Added official peak/off-peak unit pricing to the usage detail panel, with Chinese UI showing CNY and English UI showing USD.

### Fixed

- Mapped retired `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` selections to `deepseek-flash` so older sessions and pinned ids keep working.
- Synced request normalization with the latest official docs: `minimal` now maps to `low`, while `medium` and `xhigh` map to `high`.

## [1.0.2] - 2026-09-09

### Added

- Added the official `deepseek-v4-flash-vision-exp` model to the Copilot Chat picker, with `imageInput` enabled.
- Added image attachment support for DeepSeek vision requests by converting Copilot Chat image parts into the official Chat Completions `content` block format.

### Changed

- Updated README, API docs, walkthrough copy, and package metadata to reflect the latest official DeepSeek model lineup and current request semantics.

### Fixed

- Synced legacy reasoning-effort normalization with the latest official docs: `medium` and `xhigh` now both normalize to `high`.
- Prevented image requests from being sent to non-vision models, and blocked images in unsupported message roles before the API can return a 400.

## [1.0.1] - 2026-08-07

### Fixed

- **Compatibility with the latest DeepSeek V4 API**: the `reasoning_effort` field now uses the official `low` / `high` / `max` values. The picker's "None" option is replaced by **Low**, and legacy `none` configs are mapped to `thinking: { type: "disabled" }` so existing settings keep working. Legacy `medium` → `high` and `xhigh` → `max` mappings are also applied, restoring requests for both `deepseek-v4-pro` and `deepseek-v4-flash`.

## [1.0.0] - 2026-07-31

### Added

- Initial release of the DeepSeek provider for GitHub Copilot Chat.
- Built-in models: `deepseek-v4-pro` (1.6T MoE) and `deepseek-v4-flash` (284B MoE), both with 1M context and 384K max output.
- Per-model **Thinking Effort** picker (`Low` / `High` / `Max`) wired to DeepSeek's `thinking.type` + `reasoning_effort` parameters.
- Visible chain-of-thought via `LanguageModelThinkingPart` (the proposed VS Code thinking API), with `reasoning_content` preserved across tool-call turns to avoid the DeepSeek 400 error.
- SSE streaming with retry/backoff (HTTP 429 + 5xx), cancellation, and usage reporting via `LanguageModelDataPart` (`prompt_cache_hit_tokens` mapped to `prompt_tokens_details.cached_tokens`).
- Account-balance status bar (`GET /user/balance`) + webview detail panel, with `is_available: false` turning the bar red.
- Bring-your-own-key via VS Code SecretStorage (with a `apiKey` setting fallback for CI).
- Custom `baseUrl`, `customModels`, `modelIdOverrides`, `maxTokens`, `maxRetries`, `debugLogging` settings.
- Welcome walkthrough with three steps (Set API key → Show models → Pick thinking effort).
- English + Simplified Chinese localization.

# Change Log

All notable changes to the **Deepseek Family for Github Copilot Chat** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of the DeepSeek provider for GitHub Copilot Chat.
- Built-in models: `deepseek-v4-pro` (1.6T MoE) and `deepseek-v4-flash` (284B MoE), both with 1M context and 384K max output.
- Per-model **Thinking Effort** picker (`None` / `High` / `Max`) wired to DeepSeek's `thinking.type` + `reasoning_effort` parameters.
- Visible chain-of-thought via `LanguageModelThinkingPart` (the proposed VS Code thinking API), with `reasoning_content` preserved across tool-call turns to avoid the DeepSeek 400 error.
- SSE streaming with retry/backoff (HTTP 429 + 5xx), cancellation, and usage reporting via `LanguageModelDataPart` (`prompt_cache_hit_tokens` mapped to `prompt_tokens_details.cached_tokens`).
- Account-balance status bar (`GET /user/balance`) + webview detail panel, with `is_available: false` turning the bar red.
- Bring-your-own-key via VS Code SecretStorage (with a `apiKey` setting fallback for CI).
- Custom `baseUrl`, `customModels`, `modelIdOverrides`, `maxTokens`, `maxRetries`, `debugLogging` settings.
- Welcome walkthrough with three steps (Set API key → Show models → Pick thinking effort).
- English + Simplified Chinese localization.

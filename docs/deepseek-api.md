# DeepSeek API — key facts

- Docs: <https://api-docs.deepseek.com/>. OpenAI/Anthropic compatible.
- Base URLs: OpenAI format `https://api.deepseek.com`; Anthropic format `https://api.deepseek.com/anthropic`.
- Auth: `Authorization: Bearer $DEEPSEEK_API_KEY` (key from <https://platform.deepseek.com/api_keys>).
- Chat: `POST /chat/completions`, SSE streaming, `data: [DONE]` terminator.
- Responses: `POST /responses`, currently also available for `deepseek-flash` and `deepseek-v4-pro`, though this extension still uses Chat Completions for Copilot Chat compatibility.

## Models

| Model | Version | Context | Max output | Image input | Concurrency | Current pricing |
| --- | --- | --- | --- | --- | --- | --- |
| `deepseek-flash` | DeepSeek-V4.1-Flash | 1M | 384K | Yes | 2500 | Off-peak: CNY 0.02 / 1 / 4; Peak: CNY 0.04 / 2 / 8 |
| `deepseek-v4-pro` | DeepSeek-V4-Pro-0813 | 1M | 384K | No | 500 | Off-peak: CNY 0.15 / 4.5 / 13.5; Peak: CNY 0.30 / 9 / 27 |

> `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` are retired public ids. DeepSeek temporarily routes both to `deepseek-flash` and bills them at Flash rates.
>
> After 2026-09-14 12:00 Beijing time, and until V4.1 Pro is released, DeepSeek will also route `deepseek-v4-pro` requests to `deepseek-flash` and bill them at Flash rates.

Inside this extension, the **Usage Details** panel surfaces these prices by time window:

- Chinese UI: follows the official Chinese pricing page and shows CNY.
- English UI: follows the official English pricing page and shows USD.
- The panel renders three per-1M-token lines for each model: input (cache hit), input (cache miss), and output.
- Peak/off-peak schedules are shown inline because DeepSeek now uses time-based billing.

## Thinking mode

| Control | OpenAI-format parameter |
| --- | --- |
| Thinking toggle | `thinking: { type: "enabled" | "disabled" }` (defaults to **enabled**) |
| Effort control | `reasoning_effort: "none" | "low" | "high" | "max"` (default `high`; `minimal` → `low`, `medium` / `xhigh` → `high`) |

- Thinking mode **ignores** `temperature`, `top_p`, `presence_penalty`, `frequency_penalty`
  (passing them does not error, they simply have no effect).
- CoT is returned via the top-level `reasoning_content` field, alongside `content`.
- **Multi-turn concat rule**: between two `user` messages, an `assistant` turn that did **not**
  call tools does NOT need its `reasoning_content` passed back. An `assistant` turn that **did**
  call tools MUST pass `reasoning_content` back in all subsequent turns, or the API returns **400**.
- The OpenAI SDK requires `thinking` to be passed via `extra_body`:
  ```python
  client.chat.completions.create(
	      model="deepseek-flash",
      messages=...,
      reasoning_effort="high",
      extra_body={"thinking": {"type": "enabled"}},
  )
  ```

## Vision input

- The current official vision-capable model is `deepseek-flash`.
- Vision requests still use the standard Chat Completions endpoint; the difference is that a `user` message's `content` becomes an array of blocks instead of a plain string.
- For local images, the simplest official format is an inline `image_url` data URL:
  ```json
  {
    "role": "user",
    "content": [
      { "type": "text", "text": "What is in this image?" },
      { "type": "image_url", "image_url": { "url": "data:image/png;base64,<BASE64_DATA>" } }
    ]
  }
  ```
- Images are supported in `user` messages only. Sending images in `system` or `assistant` messages returns a 400.
- Supported formats: JPEG, PNG, GIF, WebP.
- `deepseek-v4-pro` is still documented as text-only on the latest pricing page.

## Streaming usage shape

DeepSeek reports usage with the final chunk when `stream_options.include_usage: true`:

```json
{
  "prompt_tokens": 12,
  "completion_tokens": 345,
  "total_tokens": 357,
  "prompt_tokens_details": {
    "cached_tokens": 8
  },
  "prompt_cache_hit_tokens": 8,
  "prompt_cache_miss_tokens": 4,
  "completion_tokens_details": {
    "reasoning_tokens": 210
  }
}
```

- `cached_tokens` (nested under `prompt_tokens_details`) **and** flat `prompt_cache_hit_tokens`
  are both present and equivalent.
- `reasoning_tokens` (under `completion_tokens_details`) is the thinking output size — billed at
  the output-token rate.

## Balance API

- `GET /user/balance` (Authorization: Bearer)
- Response:
  ```json
  {
    "is_available": true,
    "balance_infos": [
      {
        "currency": "CNY",
        "total_balance": "10.00",
        "granted_balance": "5.00",
        "topped_up_balance": "5.00"
      }
    ]
  }
  ```
- `is_available: false` ⇒ balance insufficient for inference.
- `total_balance` already nets out spent + frozen amounts (it is the usable balance).

## Rate limit & concurrency

- Per-model concurrency caps (see pricing table). Higher tiers available on request.
- `user_id` (string, `[a-zA-Z0-9\-_]{0,512}`) provides KVCache isolation + scheduling isolation.

## Endpoints used by this extension

| Purpose | Method + Path |
| --- | --- |
| Chat (stream) | `POST {base}/chat/completions` |
| User balance | `GET {base}/user/balance` |

`base` defaults to `https://api.deepseek.com` and can be overridden via `deepseek-copilot.baseUrl`.

# DeepSeek API — key facts

- Docs: <https://api-docs.deepseek.com/>. OpenAI/Anthropic compatible.
- Base URLs: OpenAI format `https://api.deepseek.com`; Anthropic format `https://api.deepseek.com/anthropic`.
- Auth: `Authorization: Bearer $DEEPSEEK_API_KEY` (key from <https://platform.deepseek.com/api_keys>).
- Chat: `POST /chat/completions`, SSE streaming, `data: [DONE]` terminator.

## Models

| Model | Params (total/active) | Context | Max output | Concurrency | Pricing (cache hit / miss / output per 1M) |
| --- | --- | --- | --- | --- | --- |
| `deepseek-v4-pro` | 1.6T / 49B | 1M | 384K | 500 | $0.0028 / $0.435 / $0.87 |
| `deepseek-v4-flash` | 284B / 13B | 1M | 384K | 2500 | $0.0028 / $0.14 / $0.28 |

> `deepseek-chat` and `deepseek-reasoner` are **deprecated on 2026/07/24 15:59 UTC** and route to
> `deepseek-v4-flash` non-thinking / thinking respectively. This extension ships only the
> `deepseek-v4-*` ids.

## Thinking mode

| Control | OpenAI-format parameter |
| --- | --- |
| Thinking toggle | `thinking: { type: "enabled" | "disabled" }` (defaults to **enabled**) |
| Effort control | `reasoning_effort: "high" | "max"` (default `high`; `low`/`medium` → `high`, `xhigh` → `max`) |

- Thinking mode **ignores** `temperature`, `top_p`, `presence_penalty`, `frequency_penalty`
  (passing them does not error, they simply have no effect).
- CoT is returned via the top-level `reasoning_content` field, alongside `content`.
- **Multi-turn concat rule**: between two `user` messages, an `assistant` turn that did **not**
  call tools does NOT need its `reasoning_content` passed back. An `assistant` turn that **did**
  call tools MUST pass `reasoning_content` back in all subsequent turns, or the API returns **400**.
- The OpenAI SDK requires `thinking` to be passed via `extra_body`:
  ```python
  client.chat.completions.create(
      model="deepseek-v4-pro",
      messages=...,
      reasoning_effort="high",
      extra_body={"thinking": {"type": "enabled"}},
  )
  ```

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

# Pick a Thinking Effort

Each DeepSeek model exposes a **Thinking Effort** selector in the model picker:

| Effort | When to use |
| --- | --- |
| **None** | Fastest, lowest cost — disables chain-of-thought entirely |
| **High** | Balanced reasoning (default) |
| **Max** | Deepest reasoning — best for hard coding, math, agentic tasks (uses more tokens) |

DeepSeek returns the chain-of-thought via the `reasoning_content` field; this extension forwards it to Copilot Chat as a **thinking** part so it renders in the dedicated thinking UI.

Open the model picker to switch:

[Open model picker](command:workbench.action.chat.modelPicker)

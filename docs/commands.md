# Merlin Engine Commands

> Merlin Engine Command Reference
>
> 本文件記錄 Merlin Engine 所有可用指令。
> 未來每新增一個指令，都應同步更新本文件。

---

# 基本概念

## Merlin Engine

Merlin Engine 為 Merlin Platform 的核心控制器（Cell Container）。

負責：

* 管理所有 Cell
* 建立 Cell
* 載入 Cell
* 切換 Cell
* 管理 Memory
* 管理 Workspace
* 管理 Thoughts
* 管理 Snapshots
* 調度 Cell
* 管理生命週期

---

## Merlin Mode

Merlin 為 Engine 本體。

```text
🧙 Merlin >
```

在 Merlin Mode 中：

* 可以管理 Cell
* 可以建立 Cell
* 可以查看狀態
* 不會執行 AI 對話

切換回 Merlin：

```bash
/merlin
```

或：

```bash
/use Merlin
```

---

## Merlin Cell

Merlin Cell 為獨立生命單位。

每個 Cell 擁有：

* Memory
* Workspace
* Thoughts
* Logs
* Snapshots
* AI Assistant

每個 Cell 都可以獨立成長。

---

# Cell Structure

```text
cells/
├── cell-001/
│   ├── cell.json
│   ├── logs/
│   ├── memory/
│   │   ├── identity.md
│   │   ├── rules.md
│   │   ├── knowledge.md
│   │   └── history.md
│   ├── thoughts/
│   │   ├── 20260531-223228.md
│   │   └── ...
│   ├── workspace/
│   └── snapshots/
│
├── cell-002/
│   └── ...
```

---

# Prompt Modes

## Merlin Mode

```text
🧙 Merlin >
```

---

## Cell Mode

```text
🧬 cell-001 >
```

```text
🧬 architect >
```

```text
🧬 reviewer >
```

---

# Commands

## /help

顯示所有指令。

### Example

```bash
/help
```

---

## /cells

列出所有 Cell。

### Example

```bash
/cells
```

---

## /status

顯示所有 Cell 狀態。

### Example

```text
┌────────────┬────────────┬─────────────┐
│ Cell       │ Status     │ Maturity    │
├────────────┼────────────┼─────────────┤
│ cell-001   │ idle       │ 2           │
│ cell-002   │ running    │ 5           │
└────────────┴────────────┴─────────────┘
```

---

## /new

建立新的 Cell。

### Example

```bash
/new architect
```

---

## /use

切換至指定 Cell。

### Example

```bash
/use architect
```

---

## /merlin

返回 Merlin Mode。

### Example

```bash
/merlin
```

---

## /whoami

查看目前所在位置。

### Merlin Mode

```bash
/whoami
```

### Output

```text
Mode      : Merlin
Role      : Engine Console
Model     : gpt-4.1
Cells     : 3
```

### Cell Mode

```text
Cell ID   : architect
Cell Name : architect
Model     : gpt-4.1
```

---

# Memory Commands

## /memory

查看目前實際注入 Prompt 的 Memory Context。

### Example

```bash
/memory
```

---

## /memory full

查看完整 Memory。

### Example

```bash
/memory full
```

包含：

* identity.md
* rules.md
* knowledge.md
* history.md

---

## /feed

向目前 Cell 注入知識。

### Example

```bash
/feed 使用 Spring Boot 3
```

### Output

```text
Memory updated.
```

---

# Thought Commands

## /thoughts

查看最近反思內容。

### Example

```bash
/thoughts
```

### Output

```text
## Learned
...
```

---

# Workspace Commands

## /workspace

列出 Workspace 檔案。

### Example

```bash
/workspace
```

---

# Snapshot Commands

## /snapshot

建立快照。

### Example

```bash
/snapshot
```

---

## /snapshots

列出快照。

### Example

```bash
/snapshots
```

---

## /restore

回復快照。

### Example

```bash
/restore snapshot-20260531-215101
```

---

## exit

關閉 Merlin Engine。

### Example

```bash
exit
```

### Output

```text
🌙 Merlin Engine hibernating...
```

---

# Conversation Flow

```text
User
 ↓
Merlin Engine
 ↓
Active Cell
 ↓
Memory
 ↓
AI Assistant
 ↓
Response
 ↓
Reflection
 ↓
Knowledge
 ↓
Thoughts
```

---

# Current Capability Matrix

| Capability         | Status |
| ------------------ | ------ |
| Multi Cell         | ✅      |
| Cell Switching     | ✅      |
| Memory             | ✅      |
| Feed Knowledge     | ✅      |
| Reflection         | ✅      |
| Thoughts           | ✅      |
| Workspace          | ✅      |
| Snapshot           | ✅      |
| Restore            | ✅      |
| Status             | ✅      |
| Maturity           | ✅      |
| Merlin Mode        | ✅      |
| Cell Communication | 🚧     |
| Broadcast          | 🚧     |
| Clone Cell         | 🚧     |
| Spawn Role Cell    | 🚧     |

---

# Future Vision

```text
                 Merlin
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
 architect       reviewer       tester
     │              │              │
     ▼              ▼              ▼
 Memory         Memory         Memory
 Thoughts       Thoughts       Thoughts
 Workspace      Workspace      Workspace
 Snapshot       Snapshot       Snapshot
```

Merlin 負責調度。

Cell 負責成長。

最終形成可自我演化的 Merlin Colony。

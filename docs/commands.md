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

## /cells

列出所有 Cell。

### Example

```bash
/cells
```

### Output

```text
cell-001
architect
reviewer
```

---

## /status

顯示所有 Cell 狀態。

### Example

```bash
/status
```

### Output

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

### Output

```text
Created and switched to architect
```

---

## /use

切換至指定 Cell。

### Example

```bash
/use architect
```

### Output

```text
Switched to architect
```

---

## /merlin

返回 Merlin Mode。

### Example

```bash
/merlin
```

### Output

```text
Returned to Merlin
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

查看目前 Cell 記憶。

### Example

```bash
/memory
```

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

# Workspace Commands

## /workspace

列出 Workspace 檔案。

### Example

```bash
/workspace
```

### Output

```text
README.md
notes/design.md
```

或：

```text
(empty workspace)
```

---

# Snapshot Commands

## /snapshot

建立快照。

### Example

```bash
/snapshot
```

### Output

```text
Snapshot created: snapshot-20260531-215101
```

---

## /snapshots

列出快照。

### Example

```bash
/snapshots
```

### Output

```text
snapshot-20260531-215101
snapshot-20260531-220010
```

---

## /restore

回復快照。

### Example

```bash
/restore snapshot-20260531-215101
```

### Output

```text
Snapshot restored: snapshot-20260531-215101
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

在 Cell Mode 中：

```text
User
 ↓
Merlin Engine
 ↓
Active Cell
 ↓
Memory
 ↓
Copilot SDK
 ↓
Response
```

---

# Current Capability Matrix

| Capability         | Status |
| ------------------ | ------ |
| Multi Cell         | ✅      |
| Cell Switching     | ✅      |
| Memory             | ✅      |
| Feed Knowledge     | ✅      |
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
 Workspace      Workspace      Workspace
 Snapshot       Snapshot       Snapshot
```

Merlin 負責調度。

Cell 負責成長。

最終形成可自我演化的 Merlin Colony。

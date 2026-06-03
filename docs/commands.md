# Cradle Engine Commands

> Cradle Engine Command Reference
>
> 本文件記錄 Cradle Engine 所有可用指令。
> 未來每新增一個指令，都應同步更新本文件。

---

# Core Philosophy

Cradle Platform 採用：

```text
Cell First
DNA First
Evolution First
```

設計哲學。

Cell 建立時不具備固定角色。

Cell 僅擁有：

* DNA
* Memory
* Goals
* Workspace
* Maturity

角色與專長不是建立時配置。

而是在成長過程中逐步形成。

---

# Basic Concepts

## Cradle Engine

Cradle Engine 為 Cradle Platform 的核心控制器（Cell Container）。

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

## Cradle Mode

Cradle 為 Engine 本體。

```text
🧙 Cradle >
```

在 Cradle Mode 中：

* 可以管理 Cell
* 可以建立 Cell
* 可以查看狀態
* 不會執行 AI 對話

切換回 Cradle：

```bash
/cradle
```

或：

```bash
/use Cradle
```

---

## Cradle Cell

Cradle Cell 為獨立生命單位。

每個 Cell 擁有：

* DNA
* Memory
* Workspace
* Thoughts
* Logs
* Snapshots
* Goals
* Maturity
* AI Assistant

每個 Cell 都可以獨立成長。

Cell 不具備預設職責。

Cell 的專長與身份會隨著：

* 學習
* 工作
* 反思
* 協作

逐步形成。

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

# Cell Profile

每個 Cell 擁有自己的 DNA 與生命狀態。

範例：

```json
{
  "id": "cell-001",
  "birthTime": "2026-05-31T22:00:00Z",
  "status": "idle",
  "maturity": 1,
  "dna": [],
  "goals": [],
  "knowledgeCount": 0
}
```

---

# Prompt Modes

## Cradle Mode

```text
🧙 Cradle >
```

---

## Cell Mode

```text
🧬 cell-001 >
```

```text
🧬 cell-002 >
```

```text
🧬 cell-003 >
```

Cell 初始為中性生命單位。

角色與專長由演化形成。

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
/new cell-002
```

### Notes

新建立的 Cell 為中性生命體。

```json
{
  "id": "cell-002",
  "maturity": 1,
  "dna": [],
  "goals": [],
  "knowledge": []
}
```

不預設任何角色。

---

## /use

切換至指定 Cell。

### Example

```bash
/use cell-002
```

---

## /cradle

返回 Cradle Mode。

### Example

```bash
/cradle
```

---

## /whoami

查看目前所在位置。

### Cradle Mode

```text
Mode      : Cradle
Role      : Engine Console
Model     : gpt-4.1
Cells     : 3
```

### Cell Mode

```text
Cell ID   : cell-001
Model     : gpt-4.1
Status    : idle
Maturity  : 3
```

---

# Memory Commands

## /dna

查看目前 Cell 的 DNA Context。

DNA 包含七個基因：

* perception.md - 如何感知外部刺激
* decision.md - 如何做決策
* decomposition.md - 如何拆解問題
* learning.md - 如何吸收經驗
* collaboration.md - 如何與其他 Cell 協作
* creation.md - 如何生成產物
* evolution.md - 如何隨時間演化

---

## /memory

查看目前實際注入 Prompt 的 Memory Context。

---

## /memory full

查看完整 Memory。

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

---

# Workspace Commands

## /workspace

列出 Workspace 檔案。

---

# Snapshot Commands

## /snapshot

建立快照。

---

## /snapshots

列出快照。

---

## /restore

回復快照。

### Example

```bash
/restore snapshot-20260531-215101
```

---

## exit

關閉 Cradle Engine。

### Output

```text
🌙 Cradle Engine hibernating...
```

---

# Conversation Flow

```text
User
 ↓
Cradle Engine
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
 ↓
DNA Evolution
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
| Cradle Mode        | ✅      |
| Cell Communication | 🚧     |
| Broadcast          | 🚧     |
| Clone Cell         | 🚧     |
| DNA Evolution      | 🚧     |
| Cell Mutation      | 🚧     |
| Cell Reproduction  | 🚧     |

---

# Cell Evolution Philosophy

生命先於角色。

Cell 建立時：

* 不指定職責
* 不指定專長
* 不指定身份

Cell 僅擁有：

* DNA
* Memory
* Goals
* Workspace
* Maturity

隨著：

* 學習
* 工作
* 反思
* 協作

逐步形成自身特徵。

最終可能演化出：

* 設計能力
* 研究能力
* 建構能力
* 評審能力

但這些能力並非建立時配置。

而是成長過程中的自然結果。

---

# Future Vision

```text
                    Cradle
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
     cell-001      cell-002      cell-003
        │              │              │
        ▼              ▼              ▼
      Memory         Memory         Memory
      Thoughts       Thoughts       Thoughts
      Workspace      Workspace      Workspace
      Snapshot       Snapshot       Snapshot
        │
        ▼
   Evolution Layer
        │
        ▼
     DNA Growth
        │
        ▼
 Specialized Traits
```

Cradle 負責調度。

Cell 負責成長。

角色不是建立出來的。

角色是演化出來的。

最終形成可自我演化的 Cradle Colony。

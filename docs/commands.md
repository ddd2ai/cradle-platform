# Merlin Engine Commands

> Merlin Engine Command Reference
>
> 本文件記錄 Merlin Engine 所有可用指令。
> 未來每新增一個指令，都應同步更新本文件。

---

# 基本概念

Merlin Platform 由兩個核心元件組成：

## Merlin Engine

Merlin Engine 為細胞培養皿（Cell Container）。

負責：

* 管理所有 Cell
* 載入 Cell
* 建立 Cell
* 切換 Cell
* 調度 Cell
* 廣播訊息
* 管理生命週期

---

## Merlin Cell

Merlin Cell 為獨立運作單位。

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
│   ├── workspace/
│   └── snapshots/
│
├── cell-002/
│   ├── cell.json
│   ├── logs/
│   ├── memory/
│   ├── workspace/
│   └── snapshots/
```

---

# Commands

## /cells

列出所有已載入 Cell。

### Usage

```bash
/cells
```

### Example

```text
cell-001
cell-002
cell-003
```

---

## /new

建立新的 Cell。

### Usage

```bash
/new <cell-id>
```

### Example

```bash
/new cell-002
```

### Result

```text
Created and switched to cell-002
```

---

## /use

切換目前操作中的 Cell。

### Usage

```bash
/use <cell-id>
```

### Example

```bash
/use cell-001
```

### Result

```text
Switched to cell-001
```

---

## exit

關閉 Merlin Engine。

### Usage

```bash
exit
```

### Result

```text
Merlin shutting down...
```

---

# Conversation

非指令內容將直接送往目前 Active Cell。

### Example

```text
設計一個會員系統
```

流程：

```text
User
 ↓
Merlin Engine
 ↓
Active Cell
 ↓
Copilot SDK
 ↓
Response
```

---

# Current Lifecycle

```text
Merlin Engine
    ↓
Load Cells
    ↓
Select Active Cell
    ↓
Receive User Input
    ↓
Dispatch To Cell
    ↓
Cell Execute
    ↓
Response
```

---

# Planned Commands

以下指令尚未實作。

---

## /status

顯示所有 Cell 狀態。

### Example

```bash
/status
```

### Output

```text
cell-001 idle
cell-002 running
cell-003 sleeping
```

---

## /clone

複製 Cell。

### Example

```bash
/clone cell-001 cell-002
```

---

## /broadcast

向所有 Cell 發送訊息。

### Example

```bash
/broadcast 設計會員系統
```

### Concept

```text
Architect Cell
Reviewer Cell
Tester Cell
Java Cell
```

同時收到任務。

---

## /spawn

建立特定職責 Cell。

### Example

```bash
/spawn architect
/spawn reviewer
/spawn tester
/spawn java-expert
```

---

## /memory

查看目前 Cell 記憶。

### Example

```bash
/memory
```

---

## /feed

向 Cell 記憶注入內容。

### Example

```bash
/feed 使用 Spring Boot 3
```

---

## /snapshot

建立 Cell 快照。

### Example

```bash
/snapshot
```

---

## /restore

回復 Cell 快照。

### Example

```bash
/restore snapshot-001
```

---

# Future Vision

```text
Merlin Platform
        │
        ▼
   Merlin Engine
        │
 ┌──────┼──────┐
 ▼      ▼      ▼
Cell   Cell   Cell
 │      │      │
 ▼      ▼      ▼
AI     AI     AI
```

Engine 負責調度。

Cell 負責成長。

最終形成可自我演化的 Merlin Colony。

# Cradle Platform

> A Living Software Engineering Platform

Cradle Platform 是一個探索「軟體生命工程（Software Life Engineering）」的實驗平台。

在 Cradle 的世界裡：

* 軟體不只是程式碼
* Agent 不只是工具
* Service 不只是 API

每一個系統都被視為一個可以成長的生命體。

---

## Vision

傳統軟體工程：

```text
Requirement
    ↓
Design
    ↓
Code
    ↓
Deploy
```

Cradle Platform：

```text
Seed
    ↓
Insight
    ↓
Model
    ↓
Cell
    ↓
Growth
    ↓
Evolution
```

我們希望讓系統能夠：

* 自我成長
* 自我組織
* 自我連結
* 自我演化

---

## Core Concepts

### Cradle Engine

Cradle Engine 是整個平台的培養皿（Incubator）。

負責：

* 啟動細胞
* 傳遞訊息
* 收集結果
* 評估成熟度

```text
Cradle Engine
    │
    ├── Cradle Cell
    ├── Cradle Cell
    └── Cradle Cell
```

---

### Cradle Cell

Cradle Cell 是平台中的最小生命單位。

每個 Cell 都擁有：

```text
Identity
Memory
Energy
Maturity
Connection
```

例如：

```text
Customer Cell
Payment Cell
Order Cell
Notification Cell
```

---

### Cradle Message

Cell 之間透過訊息交換資訊。

```text
Cell A
   │
 Message
   │
   ▼
Cell B
```

訊息可能包含：

```text
Insight
Model
Skill
Event
Task
Knowledge
```

---

### Maturity

每個 Cell 都有自己的成熟度。

```text
0   Seed
20  Insight
40  Model
60  Interface
80  Service
100 Mature
```

成熟度越高：

* 能力越完整
* 知識越豐富
* 自主性越高

---

## Architecture

```text
┌─────────────────────────┐
│     Cradle Platform     │
└───────────┬─────────────┘
            │
     ┌──────▼──────┐
     │Cradle Engine│
     └──────┬──────┘
            │
    ┌───────┼────────┐
    │       │        │
┌───▼───┐ ┌─▼────┐ ┌─▼────┐
│ Cell A│ │Cell B│ │Cell C│
└───┬───┘ └──┬───┘ └──┬───┘
    │         │        │
    └─────────┴────────┘

       Message Bus
```

---

## DNA Driven Design

Cradle 採用 DNA Driven Design 思維。

系統由語意驅動：

```text
Natural Language
        ↓
Insight
        ↓
Model
        ↓
Interface
        ↓
Implementation
```

目標不是生成程式碼。

而是讓系統能夠逐步長出程式碼。

---

## Project Structure

```text
cradle-platform/

├── engine/
│   └── cradle-engine.js
│
├── cells/
│   ├── customer-cell.js
│   ├── payment-cell.js
│   └── order-cell.js
│
├── skills/
│   ├── coding/
│   ├── modeling/
│   └── analysis/
│
├── messages/
│   └── cradle-message.js
│
├── models/
│
├── insights/
│
├── souls/
│
└── README.md
```

---

## Example

建立一個 Cell：

```javascript
const paymentCell = new CradleCell({
  id: "payment",
  name: "Payment Cell"
});
```

註冊到 Engine：

```javascript
engine.register(paymentCell);
```

啟動培養：

```javascript
engine.tick();
```

---

## Long-Term Goals

Cradle Platform 未來將探索：

### Multi-Agent Ecosystem

多個 Cell 自主合作。

---

### Software Life Engineering

軟體生命工程。

---

### VM-Based Agent Incubator

使用虛擬機培養 AI Agent。

---

### Self-Growing Architecture

由 AI 自主形成系統架構。

---

### DNA Driven Design

從語言到系統的完整映射。

---

## Philosophy

我們不把軟體看成機器。

我們把軟體看成生命。

生命會學習。

生命會成長。

生命會演化。

而 Cradle Platform 的目標，

就是成為這些生命誕生的培養皿。

# Cradle Platform

> 軟體生命工程平台（A Living Software Engineering Platform）

Cradle Platform 是一個探索「軟體生命工程（Software Life Engineering）」的實驗平台。

在 Cradle 的世界裡：

* 軟體不只是程式碼
* Agent 不只是工具
* Service 不只是 API

每一個系統，都被視為一個可以成長的生命體。

我們不只是建造系統。

我們嘗試培育生命。

---

# 願景（Vision）

傳統軟體工程的流程：

```text
需求 ──▶ 設計 ──▶ 程式碼 ──▶ 部署
```

Cradle 所追求的流程：

```text
外境刺激 ──▶ 洞察 ──▶ DNA ──▶ 模型 ──▶ 細胞 ──▶ 成長 ──▶ 演化
```

我們希望未來的系統能夠：

* 自我成長
* 自我組織
* 自我連結
* 自我演化

---

# Cradle 生命模型

每個 Cradle Cell 都由四個核心檔案所定義：

## DNA_DEFINITION.md

細胞基因定義。

描述細胞擁有哪些能力與特性。

---

## DNA_FACTORS.md

演化因子定義。

描述細胞如何成長，以及如何計算成熟度。

---

## VISION.md

願景定義。

描述細胞最終希望演化成什麼樣子。

---

## ENVIRONMENT.md

環境定義。

描述細胞所處的技術環境、限制條件與外部刺激。

---

這四個檔案共同構成一個完整生命體：

```text
DNA_DEFINITION
      +
DNA_FACTORS
      +
VISION
      +
ENVIRONMENT
      =
Cradle Cell
```

從生命的角度來看：

```text
內因 + 外境 + 願景 = 生命
```

其中：

```text
DNA_DEFINITION + DNA_FACTORS = 內因
VISION                         = 願景
ENVIRONMENT                    = 外境
```

---

# 核心概念

## Cradle Engine

Cradle Engine 是整個平台的培養皿（Incubator）。

負責：

* 啟動細胞
* 管理細胞
* 傳遞訊息
* 收集成果
* 評估成熟度
* 觀察演化過程

```text
Cradle Engine
      │
      ├── Cell
      ├── Cell
      └── Cell
```

Engine 不負責決定生命長成什麼樣子。

Engine 只負責提供生命成長的環境。

---

## Cradle Cell

Cradle Cell 是平台中的最小生命單位。

每個 Cell 都擁有：

```text
Identity
Memory
DNA
Energy
Maturity
Connections
```

例如：

```text
Customer Cell
Payment Cell
Order Cell
Notification Cell
```

未來甚至可能是：

```text
Architect Cell
Developer Cell
Research Cell
Tester Cell
```

或任何尚未被定義的生命型態。

---

## Cradle Message

Cell 透過訊息進行交流。

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
Task
Event
Knowledge
DNA
```

訊息是細胞之間的神經系統。

---

# 成熟度（Maturity）

每個 Cell 都擁有自己的成熟度。

```text
0    Seed
20   Insight
40   Model
60   Interface
80   Service
100  Mature
```

對應的生命階段：

```text
Seed
 └─ 開始存在

Insight
 └─ 開始理解

Model
 └─ 建立結構

Interface
 └─ 開始互動

Service
 └─ 產生價值

Mature
 └─ 穩定演化
```

成熟度越高：

* 能力越完整
* 知識越豐富
* 自主性越高
* 演化能力越強

成熟並不代表停止成長。

成熟代表演化趨於穩定。

---

# 架構概念

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
    │        │        │
    └────────┴────────┘

       Message Bus
```

---

# DNA Driven Design

Cradle 採用 DNA Driven Design 思維。

系統並非直接從程式碼開始。

而是從對事物本質的洞察開始。

```text
 真實世界
    ↓
 本質洞察
    ↓
  萃取DNA
    ↓
  細胞生成
    ↓
  細胞成長
    ↓
  細胞演化
```

在傳統軟體工程中，

程式碼通常被視為系統的核心。

但在 Cradle 中，

程式碼只是生命在特定環境中的顯化結果。

真正的系統並不存在於程式碼之中。

真正的系統存在於 DNA 之中。

DNA 描述了：

* 系統的本質
* 系統的能力
* 系統的規律
* 系統的演化方向

當 DNA 遇到不同的環境，

便會顯化出不同的生命形態。

因此：

```text
Code ≠ System

DNA + Environment = Living System
```

DNA Driven Design 的目標，

不是生成程式碼。

而是發現、萃取並保存系統的 DNA，

讓系統能夠持續成長、適應環境並自主演化。


---

# 專案結構

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
├── insights/
├── models/
├── souls/
│
├── DNA_DEFINITION.md
├── DNA_FACTORS.md
├── VISION.md
├── ENVIRONMENT.md
│
└── README.md
```

---

# 長期目標

## Multi-Agent Ecosystem

建立由多個 Cell 自主合作形成的生態系。

---

## Software Life Engineering

探索軟體生命工程。

---

## VM-Based Agent Incubator

使用虛擬機作為生命培養環境。

---

## Self-Growing Architecture

讓架構能夠自主形成與調整。

---

## DNA Driven Design

從事物本質中萃取 DNA，並讓系統逐步成長為可演化的生命體。

---

# 哲學（Philosophy）

我們不把軟體看成機器。

我們把軟體看成生命。

生命會學習。

生命會成長。

生命會適應環境。

生命會演化。

而 Cradle Platform 的目標，

就是成為這些生命誕生與成長的培養皿。
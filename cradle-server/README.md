# Cradle Platform

> 🌱 Cultivating Software Life through 🧬 DNA Driven Design

Cradle Platform 是一個探索「軟體生命工程（Software Life Engineering）」的實驗平台。

在 Cradle 的世界裡：

* 軟體不只是程式碼
* Agent 不只是工具
* Service 不只是 API

每一個系統，都被視為一個可以成長的生命體。

我們不只是建造系統。

我們嘗試培育生命。

---

# 平台定位

Cradle 不是單純的 AI 程式碼產生器，也不把任何一個 LLM 視為系統本身。

Cradle 是一個以生命週期為核心的軟體生產環境：Cell 接收意圖與外部刺激，依據自己的 DNA、責任邊界與技術環境產生 Artifact，再透過驗證、執行、觀察、修復與記憶逐步成長。

## North Star：用有限觀測取代逐份人工校對

Cradle 的最終目標，是讓人不需要逐份閱讀、執行與校對 AI 產物。人負責定義意圖、風險政策與可接受的品質門檻；Cradle 則透過軟體生命工程的方法，持續觀測一組有限、明確、可重現的指標，判斷 Artifact 是否已達到其用途所需的足夠品質。

```text
Human defines
Goal + Constraints + Quality Contract + Risk Policy
                         │
                         ▼
                  Cell produces Artifact
                         │
                         ▼
             Observe finite quality indicators
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       Evidence sufficient     Insufficient evidence
       all required gates      or required gate failed
              │                     │
              ▼                     ▼
      Stable / Publishable      Repair / Escalate
```

「足夠品質」不是由 LLM 自評，也不是抽象的總分。它表示：對這個 Artifact 的既定用途而言，所有必要品質閘門都已由可重現證據通過，並在指定觀測窗口內保持穩定，且沒有未解決的阻斷問題。

如果缺乏可觀測的 acceptance oracle、測試、規格或環境，Cradle 必須回報 **`insufficient_evidence`**，不能把「看起來合理」當成品質通過。人工介入應成為例外處理，而不是每個 Artifact 的預設生產步驟。

```text
User Intent / Stimulus
          │
          ▼
        Cell
  DNA + Living Context
  Memory + Environment
          │
          ▼
       Artifact
          │
          ▼
Validate → Execute → Observe
    ▲                   │
    └──── Repair ───────┘
          │
          ▼
 Memory / Maturity / Evolution
```

核心原則：

* **生命週期高於單次生成**：一次模型輸出不是最終成果，持續可驗證的成長才是。
* **Cell 擁有生命週期**：LLM 提供推理與生成能力，但不擁有 Cell 的身份、狀態或決策歷史。
* **Artifact 採單一 owner**：每份 Artifact 只有一個權威 `ownerCellId`；其他 Cell 可以提供刺激、證據與修改提案，但不能直接覆寫。
* **Artifact 不等於 Code**：文件、規格、決策、測試、圖表與程式碼都可以是 Cell 的產物。
* **模型可以不完美，生產管線必須穩定**：模型輸出必須經過解析、正規化、驗證、修復與儲存。
* **自治必須受政策控制**：修復、分裂與融合具有不同風險，結構性改變必須經過規劃、驗證與安全邊界。
* **演化必須可追溯**：DNA history、Memory、Thoughts、Lifecycle Events、Artifact Origin 與 Stability Records 共同保留演化證據。
* **品質必須由證據判定**：品質結論來自有限指標與明確閘門，不來自模型信心或人類逐份校對。

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

這四個配置檔案，共同培養出一個完整生命體：

```text
DNA_FACTORS
 (Maturity)
      ▲
100%  │                   
      │                
 80%  │                ╭──────────────────────── 
      │           ╭────╯    ENVIRONMENT   ▲
 60%  │        ╭──╯                       |
      │   ╭────╯                          |
 40%  │          🦠      🌱      🌿🌿🌿     
      │        Cell → Growth → Evolution   ──────▶ VISION
 20%  │
      │
      └──────|──────|──────|──────|───────|───────|──────▶ DNA_DEFINITION
            DNA1   DNA2   DNA3   DNA4   DNA5    DNA6
```

從生命的角度來看：

```text
內因 + 外境 + 願景 = 生命
```

其中：

```text
內部因子 = DNA_DEFINITION + DNA_FACTORS
培養願景 = VISION
外部環境 = ENVIRONMENT
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

---

# Cell Lifecycle

每一個 Cradle Cell 都遵循相同的生命週期。

Cell 並不是直接產生程式碼，而是將外部需求逐步轉化為可執行、可驗證、可持續演化的軟體產物（Artifact）。

每一個階段都具有明確的責任，使 Cradle 能夠在不同 LLM、不同模型能力下，仍維持穩定且一致的生產流程。

```text
                User Intent
                     │
                     ▼
          ① Goal Interpretation
                     │
                     ▼
          ② Production Planning
                     │
                     ▼
          ③ Artifact Generation
                     │
                     ▼
          ④ Artifact Parsing
                     │
                     ▼
          ⑤ Artifact Normalization
                     │
                     ▼
          ⑥ Artifact Validation
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
      Validation OK        Validation Failed
          │                     │
          │                ⑦ Artifact Repair
          │                     │
          └──────────┬──────────┘
                     ▼
             ⑧ Artifact Store
                     │
                     ▼
          Workspace / Project
                     │
                     ▼
             ⑨ Execution
                     │
                     ▼
            ⑩ Execution Result
                     │
                     ▼
          (Partial) Reflection
                     │
                     ▼
          (Partial) Evolution
```

## Lifecycle Stages

| Stage | Description | Current Status |
|--------|-------------|----------------|
| **① Goal Interpretation** | 理解使用者意圖、需求與限制條件。 | Implemented |
| **② Production Planning** | 根據目標制定生產計畫。 | Implemented |
| **③ Artifact Generation** | 使用 LLM 產生結構化的 Artifact。 | Implemented |
| **④ Artifact Parsing** | 將模型輸出轉換為標準 Artifact 格式。 | Implemented |
| **⑤ Artifact Normalization** | 統一路徑、格式、語言與輸出內容。 | Implemented |
| **⑥ Artifact Validation** | 驗證 Artifact 是否符合平台規範與需求。 | Implemented |
| **⑦ Artifact Repair** | 若驗證失敗，重新修正 Artifact。 | Implemented |
| **⑧ Artifact Store** | 將 Artifact 保存至 owner Cell Workspace，並拒絕跨 owner mutation。 | Implemented |
| **⑨ Execution** | 編譯或執行產出的軟體。 | Implemented for supported executors |
| **⑩ Execution Result** | 收集執行結果、日誌與狀態。 | Implemented |
| **Reflection** | 將互動、執行與修復結果保存為歷史、Thoughts 與 Stability Records。 | Partially implemented |
| **Evolution** | 根據歷史調整 DNA、責任與 Cell 結構。 | Partially implemented; closed-loop evolution remains in progress |

## Design Philosophy

在 Cradle 中，

LLM 並不是生命本身。

LLM 只是協助 Cell 進行生產的一種能力來源。

真正的生命週期，由 Cell 自己負責管理。

因此：

```text
 User Intent
      ↓
    Cell
      ↓
  Artifact
      ↓
  Execution
      ↓
  Reflection
      ↓
  Evolution
```

每一個 Cell 都能夠透過相同的生命週期，不斷地生產、驗證、修正、學習與演化。

> Code is only one possible artifact. The true product of a Cell is continuous evolution.

## Context Priority

DNA、Vision、Environment 與當前 Goal 扮演不同角色，不能互相取代：

```text
Current Goal        定義這次要完成什麼
Living Context      定義 Cell 的責任與邊界
Constraints         定義這次工作不可違反的條件
DNA                 描述 Cell 的能力、傾向與演化狀態
Environment         定義產物必須適應的技術環境
Memory / History    提供經驗，不得覆蓋當前 Goal
```

產生 Artifact 時，**使用者的當前 Goal 是工作真相**；DNA、Vision 與 Memory 提供長期方向與經驗，但不能擅自改寫 Goal。這個區分避免過去狀態干擾目前任務，同時保留跨任務的身份與學習能力。

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
  🌍           💡           🧬         🥚         🌱          🌳
真實世界 ──▶ 本質洞察 ──▶ 萃取 DNA ──▶ 細胞孵化 ──▶ 細胞成長 ──▶ 細胞演化
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
├── package.json                 # npm workspace 入口
├── cradle-server/               # Node.js / ESM runtime 與 API
│   ├── src/
│   │   ├── application/         # Use cases、operations、runtime events
│   │   ├── cell/                # Cell 狀態、記憶、任務與 runtime services
│   │   ├── dna/                 # DNA 計量、成熟度、分裂與融合模型
│   │   ├── heartbeat/           # 觀察、proposal、policy 與 lifecycle execution
│   │   ├── lifecycle/           # Repair、division、fusion 與 rollback
│   │   ├── living-context/      # Cell 責任邊界與關係
│   │   ├── production/          # Artifact 生產、驗證、修復與儲存
│   │   ├── providers/           # Copilot、Ollama、Gemini、Codex adapters
│   │   ├── cradle-engine.js
│   │   └── cradle-cell.js
│   ├── cells/                   # 各 Cell 的持久化生命狀態
│   ├── config/                  # DNA、Vision 與 Environment 定義
│   ├── situation/               # Stimuli、observations 與 metrics
│   ├── docs/
│   └── test/
└── cradle-web/                  # React / Vite observatory 與操作介面
    ├── src/
    │   ├── api/
    │   ├── components/
    │   ├── domain/
    │   ├── features/
    │   ├── pages/
    │   └── services/runtime/    # WebSocket / SSE runtime event clients
    └── test/
```

`cradle-server` 是生命週期與狀態的權威來源；`cradle-web` 負責觀察與發出操作請求。Runtime events 用來通知狀態變化，不取代 API 所提供的權威狀態。

---

# LLM Provider 架構

Cradle Platform 的 LLM Provider 是 **Cradle Cell 的感知器官**。

LLM 不是 Cradle 的核心，而是**可替換的能源**。

系統預設使用 `codex / auto`。每個 Cell 可透過
`GET/PUT /api/v1/cells/:cellId/ai` 持久化自己的 provider/model；沒有釘選的 Cell
跟隨全域預設。AI client 只在 Cell 首次需要推理時建立，因此 idle Cell 不會僅因存在或啟動就載入 provider。

## Cell Fusion CLI

使用 `/fuse` 將兩個或以上的 Cell 融合為新 Cell：

```text
/fuse cell-001 cell-002 cell-fused
```

`/merge` 暫時保留為 deprecated alias，並會執行相同的融合流程。新的使用方式應統一採用 `/fuse`。

## 架構概念

```text
cradle-ai.js
  └─ createCradleAssistant()
      只負責 Cradle 行為
      
llm-provider.js
  └─ Provider 抽象規格
  
providers/
  ├─ copilot-provider.js  (GitHub Copilot SDK)
  ├─ ollama-provider.js   (Ollama HTTP API)
  ├─ gemini-provider.js   (Google GenAI SDK)
  └─ codex-provider.js    (Codex CLI)
```

## 使用範例

### 使用 Copilot

```js
import { createCradleAssistant } from "./src/cradle-ai.js";
import { createCopilotProvider } from "./src/providers/copilot-provider.js";

const provider = await createCopilotProvider({
  model: "gpt-5-mini",
});

const assistant = await createCradleAssistant({
  provider,
  logDir: "./logs",
  cellId: "cell-001",
  cellName: "Seed Cell",
});

await assistant.ask("幫我分析目前的 DNA 狀態");
```

### 使用 Ollama

```js
import { createCradleAssistant } from "./src/cradle-ai.js";
import { createOllamaProvider } from "./src/providers/ollama-provider.js";

const provider = createOllamaProvider({
  model: "llama3.1:8b",
});

const assistant = await createCradleAssistant({
  provider,
  logDir: "./logs",
  cellId: "cell-001",
  cellName: "Seed Cell",
});

await assistant.ask("幫我思考下一步");
```

## 測試範例

```bash
# 從 workspace root 執行 server tests
npm test

# 或指定 workspace
npm test --workspace=cradle-server
npm test --workspace=cradle-web

# 驗證 web
npm run lint --workspace=cradle-web
npm run build --workspace=cradle-web
```

需要連線到外部模型的 Provider 測試與範例，必須另外準備對應的 CLI、服務或憑證；一般測試不應把特定 Provider 視為平台核心。

詳細文件請參考:
- [LLM Provider 架構文件](docs/llm-provider.md)
- [Provider 重構說明](docs/PROVIDER_REFACTOR.md)
- [Software Life Quality Model](docs/SOFTWARE_LIFE_QUALITY_MODEL.md)

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

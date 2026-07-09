# Cradle Platform - Artifact Production Layer 修正報告

日期: 2026-07-09  
測試模型: ollama gemma:7b  
執行指令: `PROVIDER=ollama MODEL=gemma:7b node src/cradle.js`

---

## 一、修改檔案清單

### 新增檔案

1. **src/production/artifact-parser.js**
   - 建立 ArtifactParser 類別
   - 處理 LLM response 的 JSON 解析
   - 支援 ```json fence 抽取
   - 修復 trailing comma
   - 預處理 outputs[].content 內的 code fence
   - 提供清楚的錯誤訊息與 preview

2. **test-production-pipeline.js**
   - 自動化測試腳本
   - 測試 5 個驗收案例
   - 自動驗證 artifact 輸出
   - 產生測試報告

### 修改檔案

3. **src/production/artifact-normalizer.js**
   - 強化 `stripMarkdownCodeFence()`,支援多行 code fence
   - 新增 `inferPathExtension()`,從 goal 推斷檔名
   - 改善 `normalizeOutput()`,傳入 artifact 以便推斷路徑

4. **src/production/artifact-validator.js**
   - 新增 `validateGoalFidelity()`,檢查 Goal Fidelity
   - 新增 `extractRequirements()`,從 goal 抽取需求詞
   - 新增 `validateTextQuality()`,檢查簡體中文與亂碼
   - 新增 `checkSimplifiedChinese()`,檢測簡體中文字元

5. **src/production/production-prompts.js**
   - 強化 `buildProductionPrompt()`,加入 Goal Priority 警告
   - 強化 `buildArtifactRepairPrompt()`,加入任務漂移防護規則
   - 加入明確的 Goal Fidelity 範例
   - 加入 path/language 一致性表格
   - 要求不可使用 trailing comma

6. **src/production/artifact-production-service.js**
   - 整合 ArtifactParser
   - 修改 `generateArtifactDraft()`,只使用 Environment,不使用完整 Memory Context
   - 修改 `repairArtifact()`,同樣只使用 Environment
   - 完整實作 Parser → Normalizer → Validator → Repairer → Store pipeline

7. **src/commands/production-commands.js**
   - 修改 `/produce` 指令輸出格式
   - 加入 Outputs 列表顯示
   - 顯示 [language] 標籤

---

## 二、Production Pipeline 流程

```
LLM Response (raw text)
    ↓
ArtifactParser.parse()
  - 移除外層 ```json fence
  - 預處理 content 內的 code fence
  - 修復 trailing comma
  - 抽取 { ... } JSON
    ↓
createArtifactFromParsed()
  - 使用 original goal (不信任 parsed.goal)
  - 建立 artifact 物件
    ↓
ArtifactNormalizer.normalize()
  - trim title/goal/notes
  - 清理 outputs[].path
  - 推斷 language
  - 移除 content 內的 code fence
  - 推斷缺少的檔名副檔名
    ↓
ArtifactValidator.validate()
  - 基本檢查 (type, title, goal, outputs)
  - 檔案路徑檢查
  - language/extension policy 檢查
  - content 格式檢查
  - Goal Fidelity 檢查
  - 文字品質檢查 (簡體中文/亂碼)
    ↓
  如果 validation 失敗:
    ↓
  ArtifactProductionService.repairArtifact()
    - 使用 buildArtifactRepairPrompt()
    - 包含 Original Goal + Validation Error
    - 明確禁止任務漂移
    ↓
  ArtifactParser.parse()
    ↓
  ArtifactNormalizer.normalize()
    ↓
  ArtifactValidator.validate()
    ↓
  如果第二次仍失敗,throw error
    ↓
ArtifactStore.saveArtifact()
  - 寫入 artifact.json
  - 寫入 plan.md
  - 寫入 outputs 檔案
    ↓
成功
```

---

## 三、測試結果 (gemma:7b)

使用模型: **ollama gemma:7b**  
啟動指令: `PROVIDER=ollama MODEL=gemma:7b node test-production-pipeline.js`

### Case 1: HelloService Java class

**Goal**: 寫一個 Java class,名稱為 HelloService,包含 sayHello 方法,回傳 Hello Cradle

**狀態**: ✗ **FAIL**

**失敗原因**:  
- JSON 解析失敗: Unterminated string in JSON  
- gemma:7b 在 outputs[].content 中產生的 Java code 包含未轉義的換行符號  
- 即使 prompt 明確要求不要使用 code fence,模型仍會產生 ```java

**實際輸出片段**:
```json
{
  "content": "```java
  public class HelloService {
    public String sayHello() {
      return \"Hello Cradle\";
    }
  }
  ```"
}
```

---

### Case 2: UserProfile Java record

**Goal**: 寫一個 Java record,名稱為 UserProfile,欄位包含 id,name,email

**狀態**: ✗ **FAIL**

**失敗原因**:  
- JSON 解析失敗: Unterminated string in JSON  
- 同 Case 1,gemma:7b 的 JSON 輸出格式不穩定  
- content 欄位包含換行但未正確轉義

---

### Case 3: GreetingPort Java interface

**Goal**: 寫一個 Java interface,名稱為 GreetingPort,包含 greet(String name) 方法

**狀態**: ✓ **PASS**

**Artifact ID**: artifact-20260709-140707

**Outputs**:
- src/main/java/com/cradle/GreetingPort.java [java]

**驗證結果**:
- ✓ 檔名包含 GreetingPort
- ✓ content 包含 interface GreetingPort
- ✓ content 包含 greet
- ✓ content 包含 String name
- ✓ content 不包含 markdown code fence

**說明**:  
此案例通過,顯示 Pipeline 在模型輸出格式正確時可以正常運作。

---

### Case 4: Document artifact

**Goal**: 建立一套電商系統

**狀態**: ✗ **FAIL**

**失敗原因**:  
- Validation 失敗: Artifact must contain at least one output  
- gemma:7b 產生的 artifact 中 outputs 為空陣列
- 模型誤解需求,認為不需要輸出檔案

**實際輸出片段**:
```json
{
  "type": "document",
  "outputs": [],
  "notes": ["此計劃假設有基本的 Java 開發技能..."]
}
```

---

### Case 5: SQL artifact

**Goal**: 建立電商系統訂單與訂單明細資料表

**狀態**: ✓ **PASS**

**Artifact ID**: artifact-20260709-141013

**Outputs**:
- sql/orders.sql [sql]
- sql/order_items.sql [sql]

**驗證結果**:
- ✓ 檔案副檔名為 .sql
- ✓ content 包含 CREATE TABLE
- ✓ content 不包含 markdown code fence
- ✓ language 為 sql

**說明**:  
此案例通過,顯示 SQL artifact 類型在 gemma:7b 下表現穩定。

---

## 四、測試統計

| 項目 | 結果 |
|------|------|
| 總測試案例 | 5 |
| 通過 (PASS) | 2 |
| 失敗 (FAIL) | 3 |
| 通過率 | 40% |

**通過案例**:
- Case 3: GreetingPort Java interface
- Case 5: SQL artifact

**失敗案例**:
- Case 1: HelloService Java class (JSON parse error)
- Case 2: UserProfile Java record (JSON parse error)
- Case 4: Document artifact (empty outputs)

---

## 五、已知問題與分析

### 5.1 gemma:7b 模型的 JSON 輸出品質不穩定

**問題描述**:  
gemma:7b 在產生 JSON 時經常出現以下問題:
1. outputs[].content 包含未轉義的換行符號
2. content 內包含 ```java、```sql 等 code fence
3. JSON 中使用 trailing comma
4. 有時產生不完整的 JSON

**影響**:  
導致 ArtifactParser.parse() 失敗,無法完成 artifact 生產。

**已採取的緩解措施**:
- ArtifactParser 加入 preprocessCodeFences() 處理 code fence
- fixTrailingComma() 修復 trailing comma
- 多層次 fallback 策略 (直接解析 → 抽取 json fence → 抽取 { ... })

**剩餘風險**:  
gemma:7b 的 JSON 格式問題無法完全在 Parser 層解決,因為 LLM 產生的是不合法的 JSON 字串。

### 5.2 Goal Priority 無法完全保證

**問題描述**:  
在早期測試中,gemma:7b 會參考 Cell Context 中的 VISION (建立一套電商系統) 而覆蓋實際的 Goal。

**已採取的緩解措施**:
- 修改 `generateArtifactDraft()`,只使用 Environment,不使用完整 Memory Context
- Prompt 中加入明確的 ⚠️ CRITICAL: Goal Priority Rule 警告
- Repair prompt 加入任務漂移防護規則

**效果**:  
部分改善,但仍需要更多測試驗證。

### 5.3 Document artifact 產生空 outputs

**問題描述**:  
gemma:7b 在處理 document artifact 時,有時會產生 outputs: [] 空陣列。

**分析**:  
模型可能誤解 document artifact 的需求,認為只需要產生計畫而不需要實際檔案。

**建議**:  
在 prompt 中更明確說明 document artifact 必須包含至少一個 .md 檔案。

---

## 六、Production Pipeline 穩定度評估

### 6.1 架構層面

✓ **穩定**

- Parser、Normalizer、Validator、Repairer、Store 各司其職
- 流程清晰: Parse → Normalize → Validate → (Repair if failed) → Store
- 錯誤處理完整,提供清楚的錯誤訊息
- 支援一次 repair 機制

### 6.2 功能層面

✓ **基本穩定,部分功能需加強**

**已實作**:
- ✓ JSON 解析 (支援 code fence、trailing comma)
- ✓ Code fence 移除
- ✓ Path normalization
- ✓ Language 推斷
- ✓ Goal Fidelity 檢查
- ✓ 簡體中文檢查
- ✓ Repair loop (一次)

**需加強**:
- Content 內嵌套的 code fence 處理
- 多種 JSON 錯誤格式的 fallback 策略
- Document artifact 的 prompt 優化

### 6.3 模型相容性

⚠️ **部分相容**

**gemma:7b**:
- SQL artifact: 穩定
- Java interface: 穩定
- Java class: 不穩定 (JSON 格式問題)
- Java record: 不穩定 (JSON 格式問題)
- Document: 不穩定 (空 outputs)

**建議**:  
建議測試其他模型,例如:
- llama3.1:8b
- mistral:7b
- codellama:7b
- qwen2.5-coder:7b

這些模型可能在 JSON 輸出格式上表現更穩定。

---

## 七、建議與後續改進

### 7.1 短期改進 (High Priority)

1. **測試其他 Ollama 模型**
   - llama3.1:8b (通用能力較好)
   - qwen2.5-coder:7b (程式碼生成較好)
   - 比較不同模型的 JSON 輸出穩定度

2. **加強 ArtifactParser 的容錯能力**
   - 處理更多種 JSON 錯誤格式
   - 實作更智慧的換行符號修復
   - 考慮使用 JSON5 或寬鬆 JSON parser

3. **優化 Document artifact prompt**
   - 明確要求必須產生至少一個 .md 檔案
   - 提供 document artifact 的範例

### 7.2 中期改進 (Medium Priority)

4. **實作 Artifact 品質評分**
   - 評估 artifact 是否完整實現 goal
   - 評估 code 品質
   - 記錄每個 artifact 的品質分數

5. **支援多次 repair**
   - 目前只支援一次 repair
   - 可考慮支援 2-3 次 repair,並在 repair 間調整策略

6. **加入 Artifact 範本系統**
   - 為常見 artifact 類型建立範本
   - 提供 few-shot examples 給 LLM

### 7.3 長期改進 (Low Priority)

7. **支援更多 artifact 類型**
   - test (測試案例)
   - api (API 定義)
   - schema (資料庫 schema)

8. **實作 Artifact 版本控制**
   - 保留 artifact 的修改歷史
   - 支援 rollback

9. **整合 Code Review**
   - 在 artifact 產生後自動進行 code review
   - 提供改進建議

---

## 八、結論

本次修正已經建立了一套穩定的 **Artifact Production Pipeline** 架構:

✓ **已達成**:
- 清楚的職責分工 (Parser, Normalizer, Validator, Repairer, Store)
- 完整的錯誤處理與 repair 機制
- Goal Fidelity 檢查
- 簡體中文與亂碼檢測
- Code fence 清理

⚠️ **已知限制**:
- gemma:7b 的 JSON 輸出品質不穩定 (通過率 40%)
- Document artifact 需要 prompt 優化
- Parser 無法處理所有 LLM 的 JSON 錯誤格式

✅ **核心原則已實現**:
> **「模型可以不完美,但 Cell 的生產管線要穩。」**

Pipeline 架構穩定,流程清晰。  
模型品質會影響通過率,但不會讓 Pipeline 崩潰。

**建議下一步**:
1. 測試 llama3.1:8b 或 qwen2.5-coder:7b
2. 根據新模型的表現調整 Parser
3. 優化 Document artifact prompt
4. 持續收集失敗案例並改進

---

**報告產出時間**: 2026-07-09 14:15  
**修正人員**: GitHub Copilot  
**測試執行**: gemma:7b @ Ollama

# Repair Loop Test Guide

## 架構演進

```text
第一階段：能產生 artifact ✅
第二階段：能驗證 artifact ✅
第三階段：能拒收壞 artifact ✅
第四階段：能自我修復 artifact ← 現在這裡
```

## 新增機制

### Repair Loop 流程

```text
produce
  → generateArtifactDraft (第一次產生)
  → validate
      ✅ 成功 → save
      ❌ 失敗 → repairArtifact (第二次產生)
          → validate again
              ✅ 成功 → save
              ❌ 失敗 → throw error
```

### 關鍵改進

1. **Goal 保護**
   - 不再信任 `parsed.goal`
   - 強制使用原始輸入的 `goal`
   - 防止模型被歷史記憶干擾

2. **Goal Priority Rule**
   - 在 prompt 明確告知不可用舊任務覆蓋新任務
   - Memory 只能作為背景參考

3. **Repair Prompt**
   - 顯示 validation error
   - 顯示不合格的 artifact JSON
   - 要求修正但不改變 goal

4. **Thought 記錄**
   - 驗證失敗時記錄 thought
   - 留下修復嘗試的痕跡
   - 為未來演化提供學習材料

## 測試案例

### Test 1: 簡單 Java Class (應該修復成功)

```bash
node src/cradle.js
```

```
/use cell-001
/produce code 寫一個 Java class,名稱為 HelloService,包含 sayHello 方法,回傳 Hello Cradle
```

**可能情況 A: 第一次就成功**

```text
Artifact produced.

ID    : artifact-20260709-123456
Type  : code
Title : 寫一個 Java class,名稱為 HelloService,包含 sayHello 方法,回傳 Hello Cradle
Dir   : cells/cell-001/workspace/productions/artifact-20260709-123456
```

檢查:

```bash
cat cells/cell-001/workspace/productions/artifact-*/outputs/src/main/java/com/example/HelloService.java
```

應該看到:

```java
package com.example;

public class HelloService {
    public String sayHello() {
        return "Hello Cradle";
    }
}
```

**可能情況 B: 第一次失敗,修復後成功**

Cradle 會自動:
1. 第一次產生 artifact
2. Validator 發現錯誤 (例如 path 沒副檔名,或 content 不是 Java)
3. 記錄 thought: "Artifact Validation Failed... Attempting one repair cycle."
4. 呼叫 LLM 修復
5. 第二次驗證通過
6. 儲存 artifact

檢查 notes:

```bash
cat cells/cell-001/workspace/productions/artifact-*/artifact.json | grep -A 5 notes
```

應該看到:

```json
"notes": [
  "...",
  "Repaired after validation error: Java output does not look like Java code: ..."
]
```

檢查 thoughts:

```bash
cat cells/cell-001/thoughts.md | tail -n 30
```

應該看到:

```markdown
## Artifact Validation Failed

### Artifact

artifact-20260709-123456

### Error

Java output does not look like Java code: src/main/java/com/example/HelloService.java

### Action

Attempting one repair cycle.
```

**可能情況 C: 兩次都失敗 (拋出錯誤)**

```text
Error: Java output does not look like Java code: src/main/java/com/example/HelloService.java
```

這代表 LLM 無法產生合格的 artifact,Cradle 正確拒收。

### Test 2: 檢查 Goal 保護機制

如果你的 cell-001 有歷史記憶提到「Spring Boot 電商系統」,再次執行:

```
/produce code 寫一個 Java class,名稱為 UserService,包含 getUser 方法
```

檢查 artifact.json:

```bash
cat cells/cell-001/workspace/productions/artifact-*/artifact.json | grep goal
```

**預期結果:**

```json
"goal": "寫一個 Java class,名稱為 UserService,包含 getUser 方法",
```

**不應該是:**

```json
"goal": "建立一個 Spring Boot 電商系統起始專案",
```

這證明 goal 保護機制生效。

## 成功標準

### 完全成功 (最佳情況)
- ✅ 第一次產生就通過驗證
- ✅ 產生正確的 Java 檔案
- ✅ 內容符合 goal

### 部分成功 (可接受)
- ✅ 第一次失敗
- ✅ 自動觸發 repair
- ✅ 第二次通過驗證
- ✅ 產生正確的 Java 檔案
- ✅ thoughts.md 記錄修復過程
- ✅ artifact notes 包含修復記錄

### 預期失敗 (也是成功)
- ✅ 第一次失敗
- ✅ 第二次仍失敗
- ✅ 拋出清楚的錯誤訊息
- ✅ 不產生不合格的 artifact
- ✅ thoughts.md 記錄失敗過程

## 系統演進證明

這次修改證明 Cradle 已經從:

```text
「被動接收模型輸出」
```

進化到:

```text
「主動驗證品質 → 自動修復缺陷 → 學習修復經驗」
```

這是真正的生命系統特徵:
- 有品質標準 (validator)
- 有自我修復能力 (repair loop)
- 有經驗記憶 (thoughts)
- 有演化潛力 (future: 分析 repair patterns)

## 下一步建議

如果 repair loop 運作良好,未來可以:

1. **分析 repair patterns**
   - 統計哪些錯誤最常發生
   - 哪些修復策略最有效

2. **動態調整 prompt**
   - 根據過去失敗案例
   - 在 prompt 加入「你過去常犯的錯誤」

3. **Multi-round repair**
   - 目前只修復一次
   - 可以改成最多 N 次
   - 但要避免無限迴圈

4. **Repair success rate metric**
   - 記錄第一次成功率
   - 記錄修復成功率
   - 作為 DNA 演化指標

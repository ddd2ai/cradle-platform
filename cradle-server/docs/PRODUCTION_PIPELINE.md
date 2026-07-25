# Production Pipeline Architecture

## 架構演進

### 之前的問題
```text
Parser 處理 JSON 又處理 content
Validator 檢查又順便修資料
Prompt 越寫越長
越補越亂
```

### 現在的架構
```text
LLM Response
  ↓
Artifact Parser      只負責把 LLM 回覆解析成 Artifact JSON
  ↓
Artifact Normalizer  只負責清理 artifact 內容,例如移除 code fence
  ↓
Artifact Validator   只負責判斷 artifact 合不合格
  ↓
Artifact Store       合格才落檔
```

## 各層職責

### 1. Parser (utils/json.js)
**職責:** 只解析外層 JSON

**策略:**
1. 整段本來就是 JSON → 直接 parse
2. 包在 ```json ... ``` → 抓出來 parse
3. 抓第一個 { 到最後一個 } → parse

**不處理:**
- ❌ 不抓一般 code fence (```java, ```xml)
- ❌ 不清理 content
- ❌ 不驗證內容

**原因:** artifact 的 outputs[].content 可能包含 code fence,parser 不該誤判

```javascript
// 錯誤範例:會誤抓 content 裡的 code fence
"content": "```java\npublic class Hello {}\n```"

// 正確做法:只抓 ```json fence
```

### 2. Normalizer (production/artifact-normalizer.js)
**職責:** 清理和標準化 artifact 資料

**處理:**
- ✅ 移除 content 的 markdown code fence
- ✅ 標準化路徑 (\ → /, 移除開頭 /)
- ✅ 自動推斷 language (如果缺少)
- ✅ 標準化 text/notes
- ✅ 補充預設值 (kind=file)

**不處理:**
- ❌ 不驗證合法性
- ❌ 不拒絕資料

**核心方法:**
```javascript
stripMarkdownCodeFence(text)
  // 移除開頭的 ```java
  // 移除結尾的 ```
  
normalizeOutputPath(path)
  // 標準化路徑格式
  
normalizeLanguage(language, path)
  // 自動從副檔名推斷 language
```

### 3. Validator (production/artifact-validator.js)
**職責:** 驗證 artifact 是否合格

**檢查:**
- ✅ 基本結構 (type/title/outputs 存在)
- ✅ 路徑合法性 (相對路徑、有副檔名、無 ..)
- ✅ language 符合 policy
- ✅ extension 符合 policy
- ✅ content 真的像該語言

**Java 內容檢查 (validateJavaContent):**
```javascript
❌ 不可以 #! 開頭 (shell script)
❌ 不可以 <?xml 開頭 (XML)
❌ 不可以 { 開頭 (JSON)
❌ 不可包含 ``` (markdown code fence)
✅ 必須包含 class/interface/enum/package
```

**不處理:**
- ❌ 不修改資料
- ❌ 不清理內容

### 4. Store (production/artifact-store.js)
**職責:** 落檔

**只做:**
- ✅ 建立目錄結構
- ✅ 寫 artifact.json
- ✅ 寫 plan.md
- ✅ 寫 outputs/*

**不處理:**
- ❌ 不驗證
- ❌ 不清理

## 完整流程

### produce() 方法
```javascript
async produce() {
  // 1. Generate (呼叫 LLM)
  let artifact = await this.generateArtifactDraft();
  
  // 2. Normalize (清理資料)
  artifact = this.normalizer.normalize(artifact);
  
  // 3. Validate (驗證品質)
  try {
    this.validator.validate(artifact);
  } catch (error) {
    // 4. Repair (修復)
    artifact = await this.repairArtifact();
    artifact = this.normalizer.normalize(artifact);
    this.validator.validate(artifact);
  }
  
  // 5. Save (落檔)
  const saved = await this.store.saveArtifact(artifact);
  
  return { artifact, saved };
}
```

## 為什麼這是最佳架構?

### 優點 1: 責任分離
```text
Parser      只解析 JSON
Normalizer  只清理資料
Validator   只檢查合法性
Store       只落檔
```

### 優點 2: 可測試性
每一層都可以獨立測試:
```javascript
// 測試 Parser
parseLooseJsonObject(`{"type": "code"}`)

// 測試 Normalizer
normalizer.stripMarkdownCodeFence("```java\ncode\n```")

// 測試 Validator
validator.validateJavaContent(output, "public class Hello {}")
```

### 優點 3: 可擴展性
未來要支援新的 artifact type:
```text
只需要:
- 在 artifact-type-policy.js 定義 policy
- 在 artifact-validator.js 加驗證邏輯
- Normalizer 不用改
- Parser 不用改
```

### 優點 4: 防禦深度
```text
第一層: Prompt 教育 LLM
第二層: Normalizer 清理髒資料
第三層: Validator 拒絕壞資料
```

即使 LLM 產生 ```java code fence,Normalizer 會清掉。
如果 Normalizer 沒清乾淨,Validator 會擋下來。

## 測試案例

### Case 1: LLM 產生 code fence

**LLM 輸出:**
```json
{
  "outputs": [{
    "path": "HelloService.java",
    "language": "java",
    "content": "```java\npublic class HelloService {}\n```"
  }]
}
```

**Pipeline 處理:**
```text
Parser      → 成功解析 JSON
Normalizer  → stripMarkdownCodeFence → "public class HelloService {}"
Validator   → 檢查 Java content → 通過 (包含 "class")
Store       → 落檔
```

### Case 2: LLM 產生 XML 在 Java 檔

**LLM 輸出:**
```json
{
  "outputs": [{
    "path": "HelloService.java",
    "language": "java",
    "content": "<?xml version=\"1.0\"?>\n<project>...</project>"
  }]
}
```

**Pipeline 處理:**
```text
Parser      → 成功解析 JSON
Normalizer  → 沒有 code fence,保持原樣
Validator   → validateJavaContent → ❌ "Java file contains XML content"
Repair      → 呼叫 LLM 修復
Normalizer  → 再次清理
Validator   → 再次檢查 → 通過或再次失敗
```

### Case 3: Parser 不會誤抓 content 裡的 fence

**LLM 輸出:**
```json
{
  "outputs": [{
    "path": "README.md",
    "language": "markdown",
    "content": "# Example\n\n```java\npublic class Example {}\n```"
  }]
}
```

**Parser 行為:**
- ✅ 不會抓 content 裡的 ```java fence
- ✅ 只抓外層 JSON 的 ```json fence 或 { }
- ✅ 保留 content 原始內容

**Normalizer 行為:**
- ✅ 因為 language=markdown,不會移除 markdown 裡的 code fence
- ✅ stripMarkdownCodeFence 只移除最外層的 fence

## 架構穩定性

這個架構能撐住未來要做的所有 artifact type:

```text
✅ document  - Markdown 文件
✅ code      - Java/JS/Python 程式碼
✅ diagram   - Mermaid/PlantUML
✅ sql       - SQL script
✅ config    - JSON/YAML/properties
⏳ test      - 單元測試
⏳ prompt    - AI prompt template
⏳ spec      - API 規格
⏳ review    - Code review report
⏳ patch     - Diff/Patch 檔案
```

每加一種 type,只需要:
1. 定義 policy
2. 加驗證邏輯
3. 不改 Parser
4. 不改 Normalizer (除非有特殊清理需求)
5. 不改 Store

## 總結

**設計哲學:**
> 模型可以不完美,但 Cell 的生產管線要穩。

**關鍵原則:**
- Parser 只解析外層 JSON
- Normalizer 只清理資料
- Validator 只拒收壞資料
- Store 只落檔

這是 Cradle Production Layer 該有的樣子。

# Production Pipeline Test Guide

## 測試目標

驗證新的 Production Pipeline 架構:
- Parser 只解析 JSON
- Normalizer 自動清理 code fence
- Validator 擋下壞資料
- Store 落檔

## 準備

```bash
node src/cradle.js start
```

```
/use cell-001
```

## Test Case 1: 簡單 Java Class (基本測試)

```
/produce code 寫一個 Java class,名稱為 HelloService,包含 sayHello 方法,回傳 Hello Cradle
```

### 預期行為

**情況 A: LLM 產生乾淨的 Java**
```javascript
{
  "outputs": [{
    "path": "src/main/java/com/example/HelloService.java",
    "language": "java",
    "content": "package com.example;\n\npublic class HelloService {\n    public String sayHello() {\n        return \"Hello Cradle\";\n    }\n}"
  }]
}
```

**Pipeline 處理:**
```text
✅ Parser      → 成功解析 JSON
✅ Normalizer  → 沒有 code fence,保持原樣
✅ Validator   → 檢查 Java content → 通過
✅ Store       → 落檔成功
```

**情況 B: LLM 產生帶 code fence 的 Java**
```javascript
{
  "outputs": [{
    "path": "src/main/java/com/example/HelloService.java",
    "language": "java",
    "content": "```java\npackage com.example;\n\npublic class HelloService {\n    public String sayHello() {\n        return \"Hello Cradle\";\n    }\n}\n```"
  }]
}
```

**Pipeline 處理:**
```text
✅ Parser      → 成功解析 JSON (不會被 content 裡的 ```java 干擾)
✅ Normalizer  → stripMarkdownCodeFence → 移除 ```java 和 ```
✅ Validator   → 檢查乾淨的 Java content → 通過
✅ Store       → 落檔成功
```

### 驗證結果

```bash
# 檢查 artifact 是否產生
ls cells/cell-001/workspace/productions/artifact-*/

# 檢查 Java 檔案內容
cat cells/cell-001/workspace/productions/artifact-*/outputs/src/main/java/com/example/HelloService.java
```

**應該看到:**
```java
package com.example;

public class HelloService {
    public String sayHello() {
        return "Hello Cradle";
    }
}
```

**不應該看到:**
```java
```java
package com.example;
...
```
```

## Test Case 2: LLM 產生錯誤內容 (驗證 Repair Loop)

如果 LLM 第一次產生這種錯誤:

```json
{
  "outputs": [{
    "path": "HelloService.java",  // ❌ 沒有副檔名
    "language": "java",
    "content": "<?xml version=\"1.0\"?>"  // ❌ Java 檔案放 XML
  }]
}
```

**Pipeline 處理:**
```text
✅ Parser      → 成功解析 JSON
✅ Normalizer  → 標準化路徑
❌ Validator   → "Output path must include file extension"
✅ Repair      → 呼叫 LLM 修復
✅ Normalizer  → 再次清理
✅ Validator   → 再次檢查 → 通過或失敗
```

### 檢查 Repair 記錄

```bash
# 查看 artifact notes
cat cells/cell-001/workspace/productions/artifact-*/artifact.json | grep -A 3 notes

# 查看 thoughts
cat cells/cell-001/thoughts.md | tail -n 40
```

**應該看到:**
```markdown
## Artifact Validation Failed

### Error

Output path must include file extension: HelloService.java

### Action

Attempting one repair cycle.
```

## Test Case 3: Markdown 文件包含 code fence (不應被清除)

```
/produce document 寫一份 Java 程式碼範例文件
```

**LLM 可能輸出:**
```json
{
  "outputs": [{
    "path": "examples/java-example.md",
    "language": "markdown",
    "content": "# Java Example\n\n```java\npublic class Example {}\n```"
  }]
}
```

**Pipeline 處理:**
```text
✅ Parser      → 成功解析 JSON
✅ Normalizer  → 不會移除 markdown 內部的 code fence
✅ Validator   → 檢查 markdown → 通過
✅ Store       → 落檔成功
```

### 驗證結果

```bash
cat cells/cell-001/workspace/productions/artifact-*/outputs/examples/java-example.md
```

**應該保留 code fence:**
```markdown
# Java Example

```java
public class Example {}
```
```

## Test Case 4: 測試 Parser 不會誤抓

建立測試檔案:

```bash
cat > /tmp/test-parser.js << 'EOF'
import { parseLooseJsonObject } from "./src/utils/json.js";

const testCase = `{
  "type": "code",
  "outputs": [{
    "path": "Example.java",
    "language": "java",
    "content": "\`\`\`java\\npublic class Example {}\\n\`\`\`"
  }]
}`;

try {
  const result = parseLooseJsonObject(testCase);
  console.log("✅ Parser 成功解析 JSON");
  console.log("Content:", result.outputs[0].content);
  
  if (result.outputs[0].content.includes("```java")) {
    console.log("✅ Content 保留了 code fence (正確)");
  } else {
    console.log("❌ Content 遺失了 code fence (錯誤)");
  }
} catch (error) {
  console.log("❌ Parser 失敗:", error.message);
}
EOF

node /tmp/test-parser.js
```

**預期輸出:**
```
✅ Parser 成功解析 JSON
Content: ```java
public class Example {}
```
✅ Content 保留了 code fence (正確)
```

這證明 Parser 不會誤抓 content 裡的 code fence。

## 成功標準

### ✅ Pipeline 正常運作
- Parser 成功解析 JSON
- Normalizer 自動清理 code fence
- Validator 通過檢查
- 產生正確的 Java 檔案

### ✅ Repair Loop 運作
- 第一次失敗時觸發 repair
- 記錄 thought
- 第二次成功或清楚失敗

### ✅ 不誤判 content
- Parser 不會抓 content 裡的 ```java
- Markdown 文件的 code fence 被保留
- 只清理 outputs[].content 最外層的 fence

## 架構驗證

執行測試後,應該確認:

```text
✅ utils/json.js       只解析外層 JSON,不抓一般 code fence
✅ artifact-normalizer.js  自動清理 content 的 code fence
✅ artifact-validator.js   擋下 Java 檔包含 ```,XML,JSON 的情況
✅ artifact-production-service.js  正確串接 normalize → validate 流程
```

## 失敗處理

如果測試失敗:

### 情況 1: Parser 錯誤抓取
```text
問題: Parser 抓到 content 裡的 ```java
解法: 檢查 utils/json.js,確認已刪除一般 fence 匹配
```

### 情況 2: Normalizer 沒清理
```text
問題: Java 檔案還有 ```java
解法: 檢查 artifact-normalizer.js stripMarkdownCodeFence()
```

### 情況 3: Validator 沒擋住
```text
問題: 壞內容通過驗證
解法: 檢查 artifact-validator.js validateJavaContent()
```

### 情況 4: Markdown 被誤清
```text
問題: Markdown 文件的 code fence 被移除
解法: 檢查 Normalizer 是否只處理 language != markdown
```

## 最終確認

```bash
# 檢查最新 artifact
ls -lt cells/cell-001/workspace/productions/ | head -n 5

# 查看 Java 檔案
find cells/cell-001/workspace/productions/artifact-* -name "*.java" -exec cat {} \;

# 確認沒有 code fence
find cells/cell-001/workspace/productions/artifact-* -name "*.java" -exec grep -l '```' {} \;
```

最後一個指令應該沒有輸出,證明 Java 檔案都很乾淨。

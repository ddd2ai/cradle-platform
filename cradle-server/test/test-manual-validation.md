# Manual Validation Test Guide

## 測試目的

驗證 ArtifactValidator 與 Production Service 整合後,能正確:
1. 通過合法 artifact
2. 拒絕不合法 artifact

## 測試步驟

### 準備

```bash
node src/cradle.js start
```

### Test Case 1: 合法的 code artifact (小型 Java class)

```bash
/produce code 寫一個 Java class,名稱為 HelloService,包含 sayHello 方法,回傳 Hello Cradle
```

**預期結果:**

✅ 成功產生 artifact,包含:
- `src/main/java/com/example/HelloService.java` (有正確副檔名)
- language=java
- content 是真正的 Java 程式碼,包含 `class HelloService`

### Test Case 2: 不合法的 code artifact (路徑沒有副檔名)

如果 LLM 產生的 JSON 是:

```json
{
  "type": "code",
  "title": "HelloService",
  "outputs": [
    {
      "path": "HelloService",  // ❌ 沒有副檔名
      "language": "java",
      "content": "public class HelloService { ... }"
    }
  ]
}
```

**預期結果:**

❌ 拋出錯誤: `Output path must have an extension`

### Test Case 3: 不合法的 code artifact (內容不符合語言)

如果 LLM 產生的 JSON 是:

```json
{
  "type": "code",
  "title": "配置檔案",
  "outputs": [
    {
      "path": "config/application.java",
      "language": "java",
      "content": "{\"server.port\": 8080}"  // ❌ Java 檔案放 JSON 內容
    }
  ]
}
```

**預期結果:**

❌ 拋出錯誤: `Java output does not look like Java code`

### Test Case 4: 合法的 document artifact

```bash
/produce document 寫一份 Cradle 專案的 README
```

**預期結果:**

✅ 成功產生 artifact,包含:
- `README.md` (有 .md 副檔名)
- language=markdown
- content 是 Markdown 格式,包含 `#` 標題

### Test Case 5: 不合法的 document artifact (產生 Java 檔案)

如果 LLM 忽略規則,產生:

```json
{
  "type": "document",
  "outputs": [
    {
      "path": "Hello.java",  // ❌ document 不可產生 .java
      "language": "java",
      "content": "public class Hello {}"
    }
  ]
}
```

**預期結果:**

❌ 拋出錯誤: `Invalid language for document artifact: java. Allowed: markdown`

## 驗證檢查點

### Prompt 層級 (教育 LLM)

查看 production-prompts.js 是否包含:
- ✅ 台灣繁體中文規則
- ✅ 副檔名規則
- ✅ content 必須符合 language 的規則
- ✅ Artifact Type Policy 的整合

### Code 層級 (驗證器)

查看 artifact-validator.js 是否包含:
- ✅ validateBasicArtifact (檢查 type/title/outputs 存在)
- ✅ validateOutputPath (檢查相對路徑、不包含 ..、必須有副檔名)
- ✅ validateOutputLanguage (檢查語言在 policy.allowedLanguages 中)
- ✅ validateOutputExtension (檢查副檔名在 policy.allowedExtensions 中)
- ✅ validateOutputContent (檢查內容真的像該語言)

### Service 層級 (整合)

查看 artifact-production-service.js 是否:
- ✅ import ArtifactValidator
- ✅ 在 constructor 建立 validator 實例
- ✅ 在 createArtifact 之後、saveArtifact 之前呼叫 validate()

## 成功標準

### 選項 A: 產生合法 artifact
- artifact.json 存在
- outputs/ 目錄存在
- 所有 output files 存在
- 檔案內容符合語言格式

### 選項 B: 拒絕不合法 artifact
- 拋出清楚的錯誤訊息
- 不產生 artifact.json
- 不建立 outputs/ 目錄
- 錯誤訊息能指出問題所在

## 實戰測試建議

建議先測試 Test Case 1 (小型 Java class),這是最簡單的合法案例。

如果成功:
- 再測試 Test Case 4 (document)
- 最後測試更複雜的 Spring Boot 專案

如果失敗:
- 檢查錯誤訊息
- 查看是 prompt 問題還是 validator 問題
- 調整對應層級的規則

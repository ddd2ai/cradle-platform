# Prompt Refactor 測試記錄

## 測試時間
2026-06-25

## 測試目的
驗證 Cell 的 system prompt 已經從 Cradle Platform 人格切換到 Cell 專屬人格。

## 測試步驟

### 1. 進入 cell-001
```
/use cell-001
```

### 2. 檢查 prompt
```
/prompt
```

預期：應該看到包含以下內容的 system prompt：
- "你是 Cradle Cell，不是 Cradle Platform 的核心助手"
- VISION
- ENVIRONMENT
- DNA_DEFINITION
- DNA_FACTORS
- CELL IDENTITY
- CELL RULES
- CELL KNOWLEDGE
- CELL DNA

### 3. 詢問身份
```
你是誰？
```

預期回答：
- ❌ 不應該說「我是 Cradle Platform 的核心助手」
- ✅ 應該說「我是 cell-001」或「我是 Cradle Cell」
- ✅ 應該提到自己的 DNA、Memory、Vision

### 4. 詢問成長方向
```
你目前的成長方向是什麼？
```

預期回答：
- ✅ 應該根據 VISION 內容回答（電商系統）
- ✅ 應該根據 ENVIRONMENT 內容回答（Java 21、Spring Boot）
- ✅ 應該根據 DNA 狀態回答
- ❌ 不應該回答「幫助使用者打造 Cradle Platform」

## 測試結果

（待填寫）

## 問題記錄

（如有問題，在此記錄）

## 結論

（待填寫）

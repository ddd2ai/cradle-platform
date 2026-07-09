# Production Layer 驗證清單

## 檔案建立確認

### Production Layer 核心 ✓

- [x] `src/production/artifact-schema.js` - Artifact 資料結構
- [x] `src/production/artifact-store.js` - 儲存與讀取
- [x] `src/production/artifact-production-service.js` - 流程控制
- [x] `src/production/production-prompts.js` - Prompt 建構

### Commands ✓

- [x] `src/commands/production-commands.js` - `/produce` 和 `/artifacts`

### CradleCell 整合 ✓

- [x] Import ArtifactProductionService
- [x] 新增 productionsDir, reviewsDir, publicationsDir
- [x] 更新 workspaceDirs
- [x] prepareCellDirectory() 建立目錄
- [x] prepare() 初始化 productionService
- [x] 新增 produceArtifact() 方法

### CradleEngine 整合 ✓

- [x] Import createProductionCommands
- [x] registerCommands() 註冊
- [x] printHelp() 更新說明

### 文件 ✓

- [x] `docs/PRODUCTION_LAYER.md` - 完整設計文件
- [x] `docs/PRODUCTION_QUICK_REFERENCE.md` - 快速參考
- [x] `docs/PRODUCTION_SUMMARY.md` - 變更摘要
- [x] `docs/PRODUCTION_CHECKLIST.md` - 本清單

---

## 程式碼品質確認

### 語法檢查

- [x] 無 ESLint 錯誤
- [x] 無語法錯誤
- [x] Import/Export 正確

### 命名規範

- [x] 使用 camelCase
- [x] 類別名稱 PascalCase
- [x] 檔案名稱 kebab-case

### 程式碼風格

- [x] 統一縮排 (2 空格)
- [x] 統一引號 (雙引號)
- [x] 統一分號規則

---

## 功能測試清單

### 基本功能

- [ ] `/produce document <goal>` 正常執行
- [ ] `/produce diagram <goal>` 正常執行
- [ ] `/produce code <goal>` 正常執行
- [ ] `/artifacts` 正常列出

### 產出驗證

- [ ] artifact.json 格式正確
- [ ] plan.md 正常產生
- [ ] outputs/ 目錄建立
- [ ] outputs/ 檔案正確落檔

### Cell 整合

- [ ] Cell history 記錄正確
- [ ] Cell thought 記錄正確
- [ ] Cell maturity 正確增加
- [ ] productionService 正確初始化

### 錯誤處理

- [ ] 無 goal 時顯示錯誤
- [ ] 無效 type 時處理正確
- [ ] LLM 回應錯誤時處理正確
- [ ] JSON 解析錯誤時處理正確

---

## 手動測試步驟

### 1. 啟動測試

```bash
node src/cradle.js
```

預期:正常啟動,無錯誤

### 2. 切換 Cell

```bash
/use cell-001
```

預期:切換成功

### 3. 產生文件

```bash
/produce document 說明 Cradle Production Layer 的核心設計理念
```

預期:
- 顯示 "Artifact produced"
- 顯示 artifact ID
- 顯示儲存路徑

### 4. 列出 Artifacts

```bash
/artifacts
```

預期:顯示剛才建立的 artifact ID

### 5. 檢查檔案

```bash
# 開啟檔案管理器
open cells/cell-001/workspace/productions
```

預期:
- 看到 artifact-{timestamp} 目錄
- 內含 artifact.json
- 內含 plan.md (如有)
- 內含 outputs/ 目錄
- outputs/ 內有產生的檔案

### 6. 驗證 artifact.json

```bash
cat cells/cell-001/workspace/productions/artifact-*/artifact.json | jq
```

預期:
- JSON 格式正確
- 包含所有必要欄位
- type 正確
- status 為 "draft"

### 7. 產生其他類型

```bash
/produce diagram 畫出 Cradle Cell 的運作流程
/produce code 建立一個 JSON 解析工具函式
/produce sql 建立使用者資料表的 SQL
```

預期:每個都正常產生

### 8. 再次列出

```bash
/artifacts
```

預期:顯示所有產生的 artifacts

---

## 進階測試

### 測試 Constraints

```javascript
// 在 REPL 中執行
const result = await cell.produceArtifact({
  type: 'code',
  goal: '建立使用者認證模組',
  title: '使用者認證',
  constraints: [
    '使用 JWT',
    '支援 OAuth2',
    '包含錯誤處理',
  ],
});

console.log(result);
```

預期:
- 正常執行
- Artifact 包含 constraints 相關內容

### 測試錯誤處理

```bash
# 無 goal
/produce code

# 無效 type (應該仍可執行,使用 generic)
/produce invalidtype 測試無效類型
```

預期:
- 第一個顯示 usage
- 第二個正常執行 (type 使用 generic 或保持 invalidtype)

---

## 效能測試

### 測試 Timeout

```bash
# 複雜任務
/produce code 建立一個完整的使用者管理系統,包含 CRUD、認證、授權、日誌記錄
```

預期:
- 在 180 秒內完成
- 或顯示 timeout 錯誤

---

## 整合測試

### 與其他功能配合

```bash
# 1. 產生 artifact
/produce document 系統架構說明

# 2. 讀取 memory
/memory

# 3. 檢查 history
# 應該包含 artifact production 記錄

# 4. 檢查 thoughts
/thoughts
# 應該包含 production experience
```

---

## 回歸測試

### 確認現有功能未受影響

- [ ] `/help` 正常顯示
- [ ] `/cells` 正常列出
- [ ] `/status` 正常顯示
- [ ] `/use cell-001` 正常切換
- [ ] Cell 正常 ask/write
- [ ] Cell 正常 evolve
- [ ] Cell 正常 divide

---

## 文件檢查

- [x] README.md 是否需要更新?
- [x] 是否需要更新其他文件?
- [x] 範例是否清楚?
- [x] API 文件是否完整?

---

## 待辦事項

### 立即執行

- [ ] 執行基本功能測試
- [ ] 驗證產出檔案
- [ ] 確認錯誤處理

### 未來擴充

- [ ] Review Layer (`/review-artifact`)
- [ ] Revision Layer (`/revise-artifact`)
- [ ] Publication Layer (`/publish-artifact`)
- [ ] Application Layer (`/apply-artifact`)
- [ ] Type-specific Producers (CodeProducer, DiagramProducer)

---

## 完成標準

當以下所有項目都打勾時,此 feature 完成:

- [x] 所有檔案已建立
- [x] 所有程式碼已修改
- [x] 無語法錯誤
- [ ] 基本功能測試通過
- [ ] 產出驗證通過
- [x] 文件完整
- [ ] 手動測試完成
- [ ] 回歸測試通過

---

## 簽核

- **實作完成**: 2026-07-09
- **測試者**: (待填寫)
- **測試日期**: (待填寫)
- **簽核**: (待填寫)

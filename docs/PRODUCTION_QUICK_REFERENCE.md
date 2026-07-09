# Production Layer - 快速參考

## 核心概念

```
Artifact 是第一級概念
Code 只是 Artifact 的一種 type
```

## 指令

```bash
/produce <type> <goal>    # 產生 Artifact
/artifacts                # 列出所有 Artifacts
```

## Artifact Types

| Type | 說明 | 範例 |
|------|------|------|
| `code` | 程式碼 | `/produce code 新增使用者認證模組` |
| `document` | 文件 | `/produce document 說明系統架構` |
| `diagram` | 圖表 | `/produce diagram 畫出資料流程圖` |
| `sql` | SQL 腳本 | `/produce sql 建立使用者資料表` |
| `config` | 設定檔 | `/produce config 產生 Docker Compose 設定` |
| `test` | 測試案例 | `/produce test 新增登入測試` |
| `spec` | 規格文件 | `/produce spec API 規格文件` |
| `generic` | 通用 | `/produce generic 任意內容` |

## 輸出結構

```
cells/{cell-id}/workspace/productions/artifact-{timestamp}/
  ├── artifact.json       # Metadata
  ├── plan.md            # 執行計畫
  └── outputs/           # 產出檔案
      └── *.ext
```

## API 範例

```javascript
// 在 Cell 中使用
const result = await cell.produceArtifact({
  type: 'code',
  goal: '建立使用者認證模組',
  title: '使用者認證',
});

console.log(result.artifact.id);
console.log(result.saved.dir);
```

## 測試流程

```bash
# 1. 啟動 Cradle
node src/cradle.js

# 2. 切換到 Cell
/use cell-001

# 3. 產生文件 (最簡單)
/produce document 測試 Production Layer

# 4. 查看產出
/artifacts

# 5. 檢查檔案
# 開啟 cells/cell-001/workspace/productions/artifact-*/
```

## 設計要點

✅ **正確**: `produceArtifact()`
- Artifact 是抽象概念
- Code 是 Artifact 的一種 type
- 支援多種產出類型

❌ **錯誤**: `generateCode()`
- 只能產生程式碼
- 窮舉式設計
- 無法擴充

## 架構層級

```
CradleCell
  └── productionService (ArtifactProductionService)
      ├── cell (CradleCell)
      ├── assistant (CradleAssistant)
      └── store (ArtifactStore)
```

## 流程

```
用戶輸入
  ↓
Cell.produceArtifact()
  ↓
ProductionService.produce()
  ↓
  1. buildMemoryContext()
  2. buildProductionPrompt()
  3. cell.askWithTimeout()
  4. parseJson()
  5. createArtifact()
  6. store.saveArtifact()
  7. cell.appendHistory()
  8. cell.appendThought()
  9. cell.mature()
  ↓
返回 { artifact, saved }
```

## 未來擴充

```bash
# Review (未實作)
/review-artifact <id>

# Publish (未實作)
/publish-artifact <id>

# Apply (未實作)
/apply-artifact <id>
```

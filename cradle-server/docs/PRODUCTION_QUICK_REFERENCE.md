# Production Layer - 快速參考

## 核心概念

```
Artifact 是第一級概念
Code 只是 Artifact 的一種 type

Cradle 的生成目標遵守 Fractal 結構：每個目標都必須能界定自己的 Goal、Boundary、Quality Contract、
Provenance、子目標與輸出。以下 Type 是目前已實作的「葉節點生成能力」，不是長期產品可生成目標的上限。
目前尚未實作自動建立 parent/child Artifact tree；在完成關係持久化、原子性與品質彙總前，不把複合編排描述為已支援。
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
| `spec` | 需求、技術或 API 規格 | `/produce spec 定義付款 API` |
| `research` | 有證據邊界的研究報告 | `/produce research 比較兩種持久化方案` |
| `test` | 測試程式、案例與 fixture | `/produce test 新增登入測試` |
| `diagram` | 圖表 | `/produce diagram 畫出資料流程圖` |
| `image` | 安全且可預覽的自包含 SVG | `/produce image 設計 Cradle 圖示` |
| `sql` | SQL 腳本 | `/produce sql 建立使用者資料表` |
| `config` | 設定檔 | `/produce config 產生 Docker Compose 設定` |
| `prompt` | 可重用 Prompt 文件 | `/produce prompt 建立程式碼審查 Prompt` |
| `decision` | 決策紀錄 | `/produce decision 記錄資料庫選型` |
| `task` | 結構化任務文件 | `/produce task 規劃登入功能` |

`executable-java` 僅為既有 CLI／執行流程的相容類型，不是預設技術棧。`generic` 只保留舊資料讀取，
不接受新的 `/produce generic`。影片目前不支援。

Type 不從自然語言猜測。CLI 的 `/produce <type> <goal>` 與 Incubator `[+]` 的 Artifact mode 都傳遞
相同的穩定 Type ID；未指定 Type 時只吸收 Stimulus。可透過 `GET /api/v1/artifact-types` 取得當前清單。

「可生成」不等於「可執行」。目前 `/execute` 只有單檔 Java 與含 `pom.xml` 的 Maven code adapter；文件、
圖表、SVG、設定、SQL、測試以及沒有已註冊 runtime adapter 的 code 會明確回傳 `skipped`，不冒充執行成功，
也不誤報成 Artifact failure。這些類型在 Store 前仍會執行各自的 deterministic validation。

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
node src/cradle.js start

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
  1. validate explicit Artifact type
  2. buildProductionPrompt()（Current Goal 優先）
  3. cell.askWithTimeout()
  4. Parse
  5. Normalize
  6. Validate
  7. bounded Repair（若需要）
  8. Store validated revision
  9. record provenance/history
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

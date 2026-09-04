# Artifact Persistence Requirements

## Problem statement

Cradle 目前已能以 `ArtifactStore` 保存產物、revision、output、blob 與
ownership，但產物主要分散在各 Cell 的 `workspace/productions/<artifactId>`。
SQLite 目前只保存 operation 與 cultivation metadata，無法快速回答：

- 某個 Artifact 的 owner Cell、type、current revision 是什麼？
- 某個 Stimulus／Source 產生或演化了哪些 Artifact？
- 某個 Cell 目前擁有哪些 Artifact？
- 哪些 output、revision、quality evidence 可以被查詢或重建？

這會讓 Incubator、Creations、quality observation 與未來跨 Cell lineage 查詢
依賴掃描檔案與讀取完整 manifest，降低大規模培養時的反應速度與可追溯性。

## Root need

建立一個穩定的 Artifact identity/catalog 邊界，讓 SQLite 能以 metadata
邏輯參照 Artifact，而不讓 SQLite 變成大型程式碼、文件、圖片或其他 output
內容的儲存桶。

## Stakeholders

| Stakeholder | Concern |
| --- | --- |
| Incubator user | 快速看到新產物、owner、type、revision 與培養結果 |
| Cell runtime | 保留 owner boundary、Stimulus provenance 與可演化 revision |
| Artifact/quality services | 以穩定 identity 查詢 current head、output metadata 與 evidence |
| API/UI | 以 catalog metadata 快速列出、篩選、恢復 authoritative state |
| Operator | 可備份、重建、檢查 orphan metadata 與 storage consistency |
| Future storage adapter | SQLite、PostgreSQL 或其他資料庫不改變 Artifact domain model |

## Functional requirements

### Must

1. 每個 Artifact 有平台指派且不可重複的 `artifactId`。
2. Catalog 必須保存 owner Cell、Artifact type、title、goal、status、current
   revision、created/updated timestamps 與 storage reference。
3. 每個 revision 以 immutable identity 保存，並能追溯 base revision、產生來源
   Stimulus/Source、producer Cell 與 quality evidence reference。
4. 每個 output 保存 path、kind、language、content hash、byte size 與 blob/
   materialized path reference；不把 output content 本身作為 SQLite 欄位。
5. Artifact head 更新必須具備 revision CAS 語意：stale base revision 不得覆蓋
   目前 head。
6. Catalog metadata 與 Artifact manifest/blob 的寫入必須能被檢查是否一致，並能
   找出 orphan catalog rows、orphan content 與 missing blob。
7. 既有 `ArtifactStore` 的 owner、lineage、quality gate 與 execution semantics
   不得因新增 catalog 而改變。
8. 現有產物可透過 migration/rebuild 建立 catalog，不要求一次搬移 content。

### Should

1. 可依 owner Cell、type、status、updated time、Stimulus、Source、revision
   查詢，不需要掃描所有產物目錄。
2. Catalog rebuild 必須是可重複、可觀測、可中斷後重跑的 operation。
3. 大型 content 使用 content-addressed blob reference；相同 hash 可重用內容。
4. Artifact 列表 API 只讀 catalog summary，需要內容時才回到 ArtifactStore。

### Won't for this slice

- 不把 Java、文件、SVG、SQL 或其他 Artifact output 全文存進 SQLite。
- 不改變目前 Artifact Type catalog，也不增加影片 Artifact。
- 不讓 SQLite 取代 ArtifactStore 的 filesystem/blob commit boundary。
- 不在本階段加入 MongoDB 或多節點分散式 locking。

## Non-functional requirements

- Identity、owner、revision head 與 lineage reference 必須可重建且可稽核。
- Metadata transaction 必須短；LLM、檔案搬移與大型 blob I/O 不得在 SQLite
  transaction 內等待。
- 內容寫入失敗不得留下可被 UI 當成已完成的 Artifact head。
- Provider-independent：catalog schema 不得包含 Codex、Ollama、Gemini 或
  Copilot SDK response shape。
- 讀取 catalog 失敗時必須明確回報 insufficient evidence/error，不可用模型推測
  Artifact 狀態。
- 舊 filesystem Artifact 與新 catalog 並存期間，必須有 migration version、
  source path 與 provenance。

## Acceptance sketch

- 一個既有 Artifact rebuild 後，可由 `artifactId` 查到 owner、type、current
  revision、outputs metadata 與 provenance。
- 新 revision 寫入後，SQLite head 與 manifest 指向同一 revision；舊 revision
  仍可讀且不可變。
- 故意提供 stale `baseRevisionId` 時，catalog/head 與 ArtifactStore 都拒絕
  mutation。
- 刪除或損壞 blob 後，consistency check 回報 missing content，而不是回報
  Artifact 已足夠。
- 重啟 server 後，Catalog summary、Cell ownership 與 Artifact lineage 與重啟
  前一致。

## Open questions

1. 專區是否要放在 project root 的 `artifacts/`，或放在被 `.runtime/` 忽略的
   runtime storage？這是可見性與備份策略的產品決策。
2. Catalog rebuild 是否由啟動時自動執行，或只由 operator 明確觸發？
3. Artifact delete/archive 的 retention policy 與 blob garbage collection
   何時定義？
4. 未來多節點部署時，是否轉 PostgreSQL + object storage；SQLite 應保留為
   single-node/default adapter。

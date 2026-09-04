# Stimulus-driven Background Cultivation

本文件描述目前已實作的 File → Stimulus → Cell → Artifact 路徑。它是 current-state 文件，不是未落地的願景。

## 使用者可觀察行為

```text
Drop file or text
  → HTTP 202 Accepted
  → Growing + real lifecycle progress
  → Stable
       or
    Needs Attention (only when a required evidence gate cannot pass)
```

使用者離開 Incubator 後，server-side operation 仍會繼續。返回畫面時，web 會讀取最近的 operation，
而每個 Cell 的 terminal cultivation state 也會持久化在該 Cell 目錄中。server 若在工作中斷，Cell 下一次
prepare 會把未完成的 `stimulated`／`growing` 狀態改為 `needs_attention`，不會假裝已完成。

## Active path 與邊界

```text
raw HTTP body
  → IngestFileStimulusUseCase
  → SourceDocumentStore (source bytes + sha256 + canonical acceptance Stimulus)
  → DocumentExtractorRegistry
  → 202 OperationRunner background task
  → StimulusCultivationService
      → deterministic Cell relevance ranking
      → deterministic salience / reflex decision
      → Cell-owned Stimulus + memory
      → optional metabolism / bounded task processing
      → optional owner-only ArtifactChangePlan
      → finite Quality Contract
      → persistent CellCultivationState
  → RuntimeEventBus → RuntimeEventAggregator → transport → web presentation store
```

- HTTP 只負責 transport decoding；domain 與 application service 接收 bytes/source/extraction，不依賴 multipart 或 PDF library。
- PDF.js 只存在於 `PdfDocumentExtractor` adapter；影像觀察則透過 `ProviderMediaAnalyzer` port。更換 extractor 或 provider 不會改變 Stimulus、Cell 或 Artifact schema。
- LLM 只透過 Cell 的既有 provider binding 呼叫。影像輸入由 `capabilities.mediaInput` 顯式宣告，沒有影像能力時安全降級，不把 domain 綁定 OpenAI、Ollama、Copilot 或 Gemini。
- REST 是 command 與 reconciliation truth；SSE／WebSocket 都只承載 canonical runtime event。

## 支援格式與 evidence policy

| 類型 | 目前處理 | Evidence outcome |
| --- | --- | --- |
| txt、md、markdown、csv、json、xml、html | deterministic UTF-8 extraction | `sufficient`，無效 UTF-8 為 `error` |
| PDF | PDF.js text-layer extraction，最多 100 頁／200k characters | 有 text layer 為 `sufficient`；掃描型 PDF 為 `insufficient_evidence` |
| PNG、JPEG、WebP、GIF | 保存原檔、signature 驗證、可得時讀尺寸，再交由 Cell provider 的 media capability 觀察 | 有結構化觀察為 `sufficient`；provider 不支援或觀察失敗為 `insufficient_evidence` / `error` |
| SVG | 以 UTF-8 text document 處理 | `sufficient` |

單檔上限 20 MiB；HTTP request 上限 21 MiB。原始來源先以 staging directory 寫入，再原子發布。
來源 manifest 保留原始檔名、media type、byte length、SHA-256、accepted time、canonical acceptance Stimulus
與 extraction evidence。每個被選中的 Cell 再建立自己的 derived Stimulus，以 `causationId` 指回來源 Stimulus；
因此無法 routing 的來源仍有 Stimulus 身分，多 Cell 也不需要共寫同一份 Cell state。

圖片不再只做 metadata extraction。`ProviderMediaAnalyzer` 要求 provider 返回事實性 summary、visible text、visual
elements 與 uncertainties，並在 evidence 保留 provider、model 與 method。這只證明「內容已被觀察」，
不等於 Artifact 品質通過；Artifact 仍必須通過各自的 Quality Contract。無 media capability 或觀察失敗時，
來源仍會保留，並以 `Needs Attention` 顯示真實的 evidence 原因。掃描型 PDF 目前仍需 PDF rasterization/OCR adapter。

## Routing、salience 與 reflex

未指定 Cell 時，routing policy 只讀各 Cell 的 Living Context、責任、input/output 與 Artifact metadata，
以可重現 term overlap 排序，最多選三個足夠相關的 Cell。指定 Cell 時 relevance 為明確使用者 target。
多 Cell 且沒有足夠 relevance evidence 時，operation 進入 `Needs Attention`，不會 broadcast 給所有 Cell。

抽取證據充足後，salience policy 以 relevance、action/state-impact、risk 與 urgency 計算：

- 低 salience：`summary-only`，只保存 Stimulus／memory 並執行便宜 metabolism。
- 高 salience：`cultivate`，以一次 bounded reasoning 形成 Observation 與至多一個 durable pending Task；Task 的深度執行交給後續 Cell runtime，不阻塞這次 ingestion operation。
- 高 salience 且 state impact 足夠：評估 Artifact evolution。
- extraction evidence 不足：保存來源與 Stimulus，要求真正必要的人類 attention。

這條 event-driven path 不要求 Cell 永久 active。原本的 `active` flag 仍控制 manual/heartbeat cultivation；
新的 cultivation state 獨立呈現 `dormant → stimulated → growing → stable | needs_attention`。
同一 Cell 的多個 background operations 由 application coordinator 排隊，避免同時 claim 同一 mailbox 或互相覆蓋狀態；
不同 Cell 會並行培養。Codex reasoning 一律在 ephemeral read-only directory 中執行；模型不能直接把檔案寫進
Cradle repository 或 Cell workspace，權威 Artifact mutation 仍只能通過 ChangePlan 與既有 validation/store path。
單次 cultivation reasoning 的 latency budget 由 `timeouts.cultivationSeconds` 控制，逾時必須留下明確失敗證據，
不能讓 operation 無界停留在 Growing。多 Cell operation 的 progress 是各 target Cell checkpoint 的平均值，phase
取最慢 Cell 的真實階段，避免並行更新造成進度倒退或過早接近 100%。

## Real progress

百分比只在實際 checkpoint 完成時更新，沒有 timer：

| Checkpoint | Progress |
| --- | ---: |
| source accepted / operation accepted | 0 |
| extraction started | 10 |
| analyzing | 15 |
| selecting target Cell | 30 |
| Stimulus persisted | 42 |
| memory / cultivation | 58 |
| durable next-growth Task formed (when required) | 68 |
| Artifact evolution (when required) | 76 |
| quality validation | 90 |
| stabilizing | 96 |
| Stable / Needs Attention decision | 100 |

UI 只把這些 checkpoint 聚合成 `Growing`、`Stable`、`Needs Attention`；reasoning、model output 與內部 log
留在 diagnostics/log surfaces。

## Operational diagnostics

既有 Logs API／頁面會收到 cultivation 的階段級 server activity，包括 source acceptance、extraction、routing、
Cell selection、Stimulus persistence、memory/metabolism、Artifact evaluation 與 terminal quality decision。每行保留
`operationId`、`sourceId`、`cellId`、Stimulus/Artifact ID 與 evidence outcome 等關聯欄位，方便確認背景工作確實執行。

這些 log 不包含檔案抽取內容、prompt、reasoning 或 model response。Logging sink 發生錯誤也不能改變 authoritative
cultivation outcome；REST 與 Cell state 仍是 truth，Logs 只是 diagnostics。

## Quality Contract 與 provenance

`stimulus-cultivation@1` 有六個 non-compensating required gates：

1. `source_integrity`
2. `content_evidence`
3. `cell_relevance`
4. `memory_recorded`
5. `artifact_integrity`
6. `provenance_recorded`

任一 gate 為 `insufficient`、`insufficient_evidence` 或 `error` 都不能宣稱 Stable。每次 cultivation lifecycle
event 保存 `stimulusId`、`sourceId`、`cellId`、Artifact/revision（若有）、quality contract/outcome 與 salience decision。

Artifact evolution 只能修改該 Cell 擁有的 Artifact。模型只能對 deterministic locator 選出的最多三個 path
提出 bounded exact replacements；ChangePlan 必須通過既有 hash precondition、revision CAS 與 validator。
成功 revision 會保存 stimulus/source provenance，Artifact 的 `evolutionHistory[]` 也保留每次變化，而非只有最終版本。
演化判斷的 bounded context 同時包含 Artifact Goal、當下 Environment、Stimulus observed time 與 evaluation time，
使 `Artifact × Environment × Time` 是可稽核 input，而不是 prompt 裝飾。

## 已知限制與 extension points

- 掃描型 PDF 的 rasterization/OCR 仍是 extractor port 的 extension point；後續 adapter 也必須輸出可追蹤 evidence，不能只回傳模型 confidence。
- 目前 operation registry 是 process-local；Cell terminal state 與 source/Stimulus/Artifact provenance 已持久化，未完成工作在 restart 後會顯示 attention。若要 restart 後自動續跑，應替換 operation repository／worker adapter，不改 domain。
- auto-routing 目前是 deterministic lexical policy；未來 semantic index 可作為 relevance adapter，但不能讓 provider output 直接成為權威 target。
- Cell／Plant／Tree visualization 與 personalization 可以消費同一個 cultivation DTO，不需要改 lifecycle。

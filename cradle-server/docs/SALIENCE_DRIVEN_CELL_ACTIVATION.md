# Salience-driven Cell Activation

Cradle 將 Cell 視為可被刺激喚醒的生命單元，而不是需要永久輪詢的 worker。

## 執行模型

```text
Stimulus / Message / Task
  -> durable queue
  -> indexed target router
  -> per-Cell durable mailbox and atomic claim
  -> batch salience policy
  -> activation decision
  -> deterministic summary or Cell reasoning
  -> evidence
  -> significance-gated evolution
```

核心不變量：

- Message received 不等於 Cell activated；inactive Cell 只保存工作。
- Cell activated 不等於 LLM required；可判定的成功結果只更新 observation。
- LLM completed 不等於 Evolution required；Evolution 必須由顯著 evidence 決定。
- Inbox 與 Stimulus 在處理前 claim，成功才 acknowledge/archive，失敗則 release。
- 全域 activation scheduler 提供 attention budget；預設最多同時處理 4 個 Cell。
- 每個 Cell 是獨立 actor：擁有自己的 mailbox、執行狀態與 activation coalescing；沒有新工作時不排程。
- actor 獨立不等於無限制平行。scheduler 只限制昂貴工作的總並行數，不參與 Cell 的業務判斷。
- REST 是權威狀態；runtime event 只傳 progress 與 invalidation summary。

## Canonical Stimulus Envelope 與 target router

所有新刺激先正規化為 versioned envelope，包含 `stimulusId`、`type`、`source`、
`targetCellIds`、`causationId`、`correlationId`、`dedupKey`、`salience`、`summary`
與結構化 `facts`。舊 Markdown stimulus 只透過 compatibility adapter 讀取。

router 直接把 envelope 寫入 `stimuli/queues/<cellId>/`。因此 Cell 只讀自己的 queue，
不再掃描全部 Cell 或對每個事件做 broadcast fan-out；dedup key 使用持久化 hash index 做原子建立。

新事件會喚醒目標 Cell 的 actor，但 inactive Cell 只累積 durable work。啟動 Cell 後才會 claim，
處理成功 archive，失敗 release，避免「收到訊息」直接等同「執行 LLM」。

## 複雜度目標

| 路徑 | 舊模型 | 新模型 |
| --- | --- | --- |
| idle Active Cells | 每 10 秒 `O(N)` | `O(K)`，idle 時 `K = 0` |
| Inbox append | `O(M)` 整檔重寫 | 均攤 `O(1)` |
| Task append / complete | `O(T)` 整檔重寫 | 均攤 `O(1)` |
| pending Task lookup | `O(T)` 歷史掃描 | `O(P)` pending queue |
| shared Stimulus LLM fan-out | 最壞 `O(N)` 次 | atomic claim 後最多一次 |
| targeted Stimulus routing | broadcast / shared scan `O(N)` | `O(R)`，`R` 為明確 target 數 |
| Cell stimulus lookup | `O(S)` shared directory scan | `O(Qᵢ)`，只讀該 Cell queue |
| heartbeat proposal writes | `O(N)` | `O(A)` actionable proposals |
| terminal runtime payload | `O(result size)` | `O(1)` summary，結果由 REST 讀取 |
| terminal reconciliation | 所有 loader | 只刷新受影響資源 |

`N` 是 Cell 數、`M` 是 Inbox 歷史、`T` 是 Task 歷史、`P` 是 pending Task 數、`K` 是有工作的 Cell 數、`A` 是 actionable proposal 數。

`R` 是刺激的 target 數、`Qᵢ` 是單一 Cell 自己的 pending stimulus 數。legacy Markdown
目錄在遷移期間仍會相容讀取，不屬於新路徑的複雜度保證。

## Salience policy

第一層只能使用 deterministic logic，不可為了判斷是否要呼叫 LLM 而先呼叫另一個 LLM。目前已知 `internal.execution` 的 `passed` / `skipped` 是 summary-only；失敗、未知或可能改變決策的刺激才進 reasoning。

policy 以 envelope 的 novelty/dedup、causation、target、impact、risk 與 confidence 判斷，
並保持為不依賴檔案系統、transport 或 LLM provider 的純規則。

## Evolution significance gate

Evolution 不再由 thought 數量門檻觸發。Cell 先累積結構化 evidence，只有以下情況之一才允許演化：

- 單一 critical evidence 同時達到 impact、risk、confidence 門檻。
- 至少兩個不同 cause 都達到可採納的 impact 與 confidence。
- 操作者明確使用 force。

成功演化後才消耗相應 evidence；一般活動、重複事件與 summary-only execution result 不會推動 DNA 演化。

## 資源設定

`runtime.activationConcurrency` 控制同時執行的 Cell actor 數，預設為 `4`。API runtime 也可用
`CRADLE_ACTIVATION_CONCURRENCY` 覆寫。這是 attention budget，不是 Cell 數量上限。

48GB RAM 的單機建議仍依 provider 調整：遠端模型可先從 4 到 6；本機 24B 模型通常先從
1 到 2，觀測 RSS、模型 context/KV cache、queue age 與 p95 latency 後再提高。SSD 容量適合
durable queues，但 dedup 與 processed archive 仍需後續 retention/compaction policy。

## 必要指標

- `activation_count / admitted_stimulus_count`
- `llm_call_count / admitted_stimulus_count`
- dedup、filter、summary-only、reasoning 各分支數量
- queue age p50/p95、processing latency p50/p95
- idle CPU、event-loop delay、RSS、檔案讀寫次數
- runtime event bytes、terminal REST request 數
- `evolution_count / significant_state_change_count`

目前可由 `GET /api/v1/metrics` 取得 process-local counters、gauges 與 latency distributions
（含 p50/p95），用來比較 activation、LLM、queue 與 evolution gate 的放大比率。

## 下一階段：Cell AI 與 Cradle AI 分層

建議採用兩層 AI，而不是一個中央模型處理所有事件：

- **Cell AI**：每個 Cell 綁定自己的 provider/model、context budget、mailbox 與 memory，負責局部領域推理與產物。
- **Cradle AI**：具 colony-wide read model，負責分裂、融合、跨 Cell 衝突、資源配置與演化方案等結構性決策。
- **Deterministic control plane**：負責 salience、quota、capability、claim/ack、evidence 與 policy；兩層 AI 都不能繞過。

Cradle AI 不應直接監聽每筆低價值事件，也不應任意寫入所有 Cell。它只接收聚合後的 colony summary
或 structural proposal，輸出可驗證的 plan，再由 application service 執行。如此可避免中央 AI 成為新的
LLM fan-out、單點瓶頸與無邊界權限來源。

目前每個 Cell 已建立獨立 assistant/provider instance，但 provider/model 的設定仍是 colony-wide default。
要完成真正的 heterogeneous model colony，下一階段需加入 per-Cell AI binding、provider-specific concurrency
budget、模型健康狀態、fallback policy，以及結構操作專用的 Cradle supervisor port。

「遇強則強」應由 resource governor 實現，而不是用 RAM 數量直接放大所有 Cell：啟動時建立 CPU、RAM、
GPU/統一記憶體、磁碟與 provider quota 的 capability profile；執行時根據每個 model 的實測 memory、latency
與 token throughput 做 weighted admission control。壓力上升時降低本機大型模型並行或改用遠端 provider，
資源充足且 queue age 上升時才漸進提高 concurrency。這使同一套 Cell 語意能在不同硬體上安全擴縮。

## 下一階段：Incremental Artifact Evolution

目前 production、execution repair、division 與 fusion 都要求模型回傳完整 `outputs[]`，而 `artifact.json` 也內嵌
所有 output content；所以即使只修一個方法，LLM token、validation 與 metadata write 仍接近整個 Artifact 大小。

建議的新路徑：

```text
Failure / Change Request
  -> deterministic locator (file, symbol, diagnostic)
  -> dependency/impact index
  -> minimal ArtifactChangePlan
  -> Cell AI produces bounded patch
  -> precondition + policy validation
  -> apply to immutable revision
  -> targeted execution/tests
  -> promote revision or rollback
```

`ArtifactChangePlan` 應包含 base revision、允許修改的 path/symbol、content hash precondition、問題 evidence、
不可改變的不變量與驗證命令。模型只能輸出指定範圍的 patch；application service 檢查越界修改、套用 patch，
失敗時保留舊 revision。跨 bounded context、分裂、融合或 dependency graph 大幅改變時才退回完整 regeneration。

儲存層需將 Artifact manifest 與 output blobs/revisions 分離，否則改一個檔案仍會重寫含全部 content 的
`artifact.json`。完成索引後，一般修改的目標成本可從 `O(B)` 降為 `O(Δ + D)`：`B` 是 Artifact 總大小、
`Δ` 是 patch neighborhood、`D` 是受影響 dependency closure；索引首次建立仍為 `O(B)`，之後依 revision 增量更新。

Cradle AI 適合審核 structural change plan 與跨 Cell impact；一般局部修復由該 Artifact 所屬的 Cell AI 完成，
避免中央模型接觸每個檔案修改。

效能驗證必須同時觀測吞吐、延遲與品質；不能藉由丟棄重要刺激換取較漂亮的效能數字。

# Salience-driven Cell Activation

Cradle 將 Cell 視為可被刺激喚醒的生命單元，而不是需要永久輪詢的 worker。

## 執行模型

```text
Stimulus / Message / Task
  -> durable queue
  -> indexed target router
  -> deterministic pre-activation admission
       -> summary-only debounce/flush (no Cell activation, no LLM)
       -> activation request
  -> per-Cell durable mailbox and atomic claim
  -> batch partition (summary-only vs reasoning)
  -> deterministic summary or Cell reasoning
  -> evidence
  -> significance-gated evolution
```

核心不變量：

- Message received 不等於 Cell activated；inactive Cell 只保存工作。
- 重複 Stimulus 在 durable dedup 命中後不會發出 wake-up。
- 已知 `passed` / `skipped` execution stimulus 只排入可合併的 summary flush，不進 activation scheduler。
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
| passive execution activation | 每筆至少一次 Cell activation | `O(1)` durable write，debounce 後一次 summary flush |
| targeted Stimulus routing | broadcast / shared scan `O(N)` | `O(R)`，`R` 為明確 target 數 |
| Cell stimulus lookup | `O(S)` shared directory scan | `O(Qᵢ)`，只讀該 Cell queue |
| heartbeat proposal writes | `O(N)` | `O(A)` actionable proposals |
| terminal runtime payload | `O(result size)` | `O(1)` summary，結果由 REST 讀取 |
| terminal reconciliation | 所有 loader | 只刷新受影響資源 |
| incremental Artifact blob reads | `O(B)` 全內容 | typical `O(Δ)`；不確定時安全回退 `O(B)` |
| incremental Artifact validation | `O(B)` 全內容 | typical `O(Δ + G)`；證據不足才回退 `O(B)` |
| Artifact target location | `O(F × S)` metadata scan | indexed `O(L + K + C × S)`；legacy 安全回退 |
| pre-LLM repair context | `O(F)` flat manifest parse | `O(H + K + C + Δ)` repair head + candidates |
| incremental Artifact promote | `O(F + B)` 重寫完整產物 | typical `O(Δ + I)`；threshold compaction `O(F + ΣΔᵣ)` metadata-only |
| current Artifact full read | `O(F + B)` | metadata `O(F + min(ΣΔᵣ, Cₘ))`、content `O(B)` |
| concurrent Artifact writers | last-writer-wins / lost update | `O(1)` keyed lease；相同 base 只允許一個 promote |

`N` 是 Cell 數、`M` 是 Inbox 歷史、`T` 是 Task 歷史、`P` 是 pending Task 數、`K` 是有工作的 Cell 數、`A` 是 actionable proposal 數、`F` 是 Artifact 檔案數、`B` 是全部 output bytes、`Δ` 是命中修復範圍的 bytes、`G` 是 Goal 中明確需求詞數。Artifact lookup 中 `L` 是 evidence 長度、`K` 是 bounded lookup key 數、`C` 是索引命中的 candidate 數、`S ≤ 256` 是單檔宣告 symbol 上限；`I` 是 changed outputs 影響的索引詞數，`ΣΔᵣ` 是自最近 full snapshot 起的累積 revision delta metadata，`Cₘ` 是 compaction policy 設定的固定上限。

`R` 是刺激的 target 數、`Qᵢ` 是單一 Cell 自己的 pending stimulus 數。legacy Markdown
目錄在遷移期間仍會相容讀取，不屬於新路徑的複雜度保證。

## Salience policy

第一層只能使用 deterministic logic，不可為了判斷是否要呼叫 LLM 而先呼叫另一個 LLM。目前已知
`internal.execution` 的 `passed` / `skipped` 在 durable write 後、activation 前就判定為 summary-only；
它們透過 per-Cell debounce 合併，直接寫 observation/evidence。失敗、未知或可能改變決策的刺激才進 scheduler。

若 passive 與 actionable stimuli 同時存在，batch policy 會分割兩者：passive 部分產生 deterministic summary，
只有 actionable 部分進入 reasoning prompt，避免 aggregation 反而把低價值內容帶回 LLM context。

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
- `summary_flush_processed / summary_flush_started`
- `stimulus_activation_decision{decision=summary-only|activate}`
- `llm_call_count / admitted_stimulus_count`
- dedup、filter、summary-only、reasoning 各分支數量
- queue age p50/p95、processing latency p50/p95
- idle CPU、event-loop delay、RSS、檔案讀寫次數
- runtime event bytes、terminal REST request 數
- `evolution_count / significant_state_change_count`
- `artifact_repair_input_scope_ratio`
- `artifact_incremental_selective_hydration_bytes`
- `artifact_repair_content_bytes_avoided`
- `artifact_incremental_full_validation_fallback{reason}`
- `artifact_impact_lookup{mode=indexed|scan-fallback,matched}`
- `artifact_impact_lookup_key_count`
- `artifact_impact_candidate_ratio`
- `artifact_impact_index_sync{mode=full|incremental|unavailable,updated}`
- `artifact_repair_context{mode=head|manifest-fallback}`
- `artifact_impact_candidate_overflow`
- `artifact_revision_storage{mode=delta|full}`
- `artifact_flat_manifest_reads_avoided`
- `artifact_revision_delta_depth`
- `artifact_revision_compaction{result=performed|deferred|failed,reason}`
- `artifact_mutation_lease_wait_ms`
- `artifact_mutation_lease_contention`
- `artifact_mutation_stale_lease_recovered`

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

目前每個 Cell 已有持久化的 per-Cell AI binding，可用 `GET/PUT /api/v1/cells/:cellId/ai`
讀取或釘選 provider/model。未釘選的 Cell 跟隨 colony default；已釘選的 Cell 不受全域設定覆寫。
assistant/provider 改為首次推理才 lazy load，沒有重要刺激的 Cell 不再只因啟動而配置 AI client。
產品預設為 `codex / auto`，Copilot、Ollama 與 Gemini 仍是可替換 adapter。

真正完整的 heterogeneous model colony 還需要 provider-specific weighted concurrency budget、模型健康狀態、
fallback policy，以及結構操作專用的 Cradle supervisor port。現有 activation scheduler 管的是 Cell 工作數，
還不能反映本機 24B 模型和遠端 API 呼叫的資源成本差異。

「遇強則強」應由 resource governor 實現，而不是用 RAM 數量直接放大所有 Cell：啟動時建立 CPU、RAM、
GPU/統一記憶體、磁碟與 provider quota 的 capability profile；執行時根據每個 model 的實測 memory、latency
與 token throughput 做 weighted admission control。壓力上升時降低本機大型模型並行或改用遠端 provider，
資源充足且 queue age 上升時才漸進提高 concurrency。這使同一套 Cell 語意能在不同硬體上安全擴縮。

## 下一階段：Incremental Artifact Evolution

初始 production、division 與 fusion 仍要求模型回傳完整 `outputs[]`。execution repair 已先採 incremental-first：
由 deterministic locator 根據 diagnostic path/symbol 選出最多三個 output，再要求 Cell AI 回傳有 hash
precondition 的 bounded replacements；無法安全定位或 patch 驗證失敗才退回完整 regeneration。

目前路徑（dependency edges 與 targeted tests 尚待下一階段）：

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

`ArtifactChangePlan` 現在包含 base revision、允許修改的 path、content hash precondition、問題 evidence 與
結果 hash。模型只能修改 locator 選定範圍；application service 檢查越界修改、舊文字唯一性與結果 hash，
失敗時保留舊 revision。跨 bounded context、分裂、融合或 dependency graph 大幅改變時仍退回完整 regeneration。

儲存層已將 Artifact manifest 與 content-addressed output blobs/revision manifests 分離，並相容讀取舊版
內嵌 content 的 `artifact.json`。full save 會建立新的 flat snapshot；incremental promote 則只寫 changed output
metadata/blob 的 immutable delta revision，再以原子 rename 發布 `current.json` pointer。未改變 output 直接沿用
舊 revision，因而不再 parse、map 或重寫整份 outputs array。所有正式讀取必須經過 `ArtifactStore`；直接讀
`artifact.json` 只會看到最近一次 full snapshot，不是 delta chain 的權威 current view。

`ArtifactStore` 由 current revision 反向追蹤 `baseRevisionId`，在 full read 時一次合併 output map；rollback 會
寫入新的 full revision 並壓平 chain。`current.json` 同時記錄 delta depth 與累積 metadata bytes；預設到 32 層
或 1 MiB 就把 current metadata 原子壓平成新的 flat snapshot，不讀取 content blobs。revision resolver 另有
循環與 256 層 emergency 上限保護。compaction 失敗不會推翻已發布的 delta，後續仍可由 revision chain 讀取。
delta revision、blob 與 output 檔案完成後才發布 current pointer；impact index 仍是可失效、可重建的
衍生狀態，不能取代 pointer/revision chain 的權威性。

同一 runtime 內的 mutation coordinator 先序列化相同 Artifact path；filesystem adapter 再以原子建立的
`.mutation.lock` lease 保護共享檔案系統上的不同 Node runtime。不同 Artifact 仍可平行。因此多個 Cell 同時
從同一 base revision 提交 patch 時，只會有一個 promote；另一個取得 lease 後會由 authoritative current
pointer 判定 stale，不會 lost update。lease 只在實際 mutation contention 時採 bounded exponential backoff，
不是 idle Cell polling；持有期間定期更新 mtime，process crash 留下的 stale lease 可由 token-aware recovery
安全接管，舊 owner 不會刪除新 owner 的 lock。

這個 lease 的一致性範圍是所有看到同一 productions filesystem 的 process。未共享檔案系統的多主機部署仍需
使用具 compare-and-swap 語意的外部 revision repository 或 distributed lease adapter。

Artifact save 會建立獨立的 path/symbol inverted index。lookup key 使用 SHA-256 檔名並以 hash prefix 分片；
每個 output 另有 reverse record，使 incremental revision 只需移除/新增 changed paths 的 postings，不必重建
全部索引。revision marker 最後才發布，避免 repair 讀到更新一半的索引。索引是可失效、可重建的衍生狀態；
寫入失敗不會推翻已成功的 Artifact save，查詢失敗則走 deterministic scan fallback。

`declaredSymbols` 不再複製進主 Artifact manifest，而由索引 adapter 擁有。主 manifest 只保留 output metadata、
content hash/bytes 與 Goal 明確需求詞索引，因此 parse 不再帶 `F × S` 的 symbol 體積。legacy revision 沒有
inverted index 時仍可用 path/content metadata 定位；無法安全定位就退回完整 regeneration。

index marker 同時提供不含 `outputs[]` 的小型 repair head，reverse record 提供 candidate output metadata。
repair service 因此先讀 head、bounded lookup keys、candidate metadata 與命中的 content blobs，直接建立 LLM
prompt；模型提出 patch 後以 repair head 的 Goal-term coverage 和 changed outputs 計算 significant state delta，
一般成功路徑不再讀 flat manifest。只有 coverage 缺失、不相容或無法證明 Goal fidelity 時才 hydrate 完整
Artifact，執行完整 validator 並以 full revision 壓平儲存。
單一 output 即使 evidence 沒有檔名，也會由 head 的 `singleOutputPath` 走 deterministic index lookup。

索引缺失或版本不相容時，仍讀權威 manifest 執行原本 scan。candidate 超過 64 個視為不適合 bounded
incremental repair，不會把大量 metadata/context 放進 LLM。索引缺失、Goal 改變或要求詞無法證明時，才
hydrate 全 Artifact 並執行完整 validator。成功後回傳 repair head 加 `changedOutputs`，避免 response 再攜帶
全部 manifest；新 revision 另檢查 `baseRevisionId`，防止延後讀取 manifest 時被併發更新覆蓋。

因此典型 content I/O 與 LLM context 由 `O(B)` 降為 `O(Δ)`；target scoring 由 `O(F × S)` 降為
`O(L + K + C × S)`，且 LLM 前後都不再支付 flat manifest 的 `O(F)`。bounded change-plan apply、Goal delta
validation 與 promote 的常見成本為 `O(Δ + G + I)`。完整讀取仍需輸出全部 metadata/content，無法低於
`O(F + B)`。目前 depth/bytes compaction 已將 revision-chain 額外成本限制在固定 policy 範圍；下一階段應
加入 dependency edges、targeted execution/tests，以及在大型 Artifact 上把 synchronous metadata compaction
移至可恢復的 background maintenance queue。`D` 為受影響 dependency 數。

Cradle AI 適合審核 structural change plan 與跨 Cell impact；一般局部修復由該 Artifact 所屬的 Cell AI 完成，
避免中央模型接觸每個檔案修改。

效能驗證必須同時觀測吞吐、延遲與品質；不能藉由丟棄重要刺激換取較漂亮的效能數字。

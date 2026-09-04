# Cradle 效能基準與優化紀錄

本文件是 Cradle 效能工程的持續證據帳本。每次修改 activation、event propagation、Artifact I/O、
revision、queue、render、network 或 LLM admission，都必須在同一個變更中追加測試紀錄。

目標不是只讓單次工作變快，而是優先消除不必要工作，並確認效能改善沒有犧牲重要刺激、品質判定、
一致性或可恢復性。

## 紀錄規則

每次效能優化至少記錄：

1. 日期、runtime revision、變更範圍與要消除的 amplification。
2. 預期的 Big-O 變化與不可破壞的 correctness invariant。
3. 可重現命令、硬體、Node 版本、資料量、warm-up、sample count、cache 與 durability 模式。
4. 相同條件下的 before／after p50、p95、throughput，以及對應的 CPU、memory、network、render、queue、LLM 或 contention 指標。
5. focused tests、相關 regression suite 與資料一致性檢查。
6. 限制、異常值與下一個已知瓶頸。

只有同硬體、同 workload、同設定與同量測方法的前後數據，才能宣稱改善倍率或百分比。若沒有可比較的
優化前資料，紀錄必須標示為 `current-state only`。舊紀錄採 append-only，不因新硬體或新方法而覆寫。

## 標準 Benchmark

Artifact output scaling 與多 Cell mutation contention：

```bash
npm run benchmark:artifact
```

預設矩陣：

- outputs：10、100、1000；每個 output 約 4096 bytes。
- Cells：2、4、8、16。
- scaling：2 次 warm-up、7 次正式 samples。
- contention：1 次 warm-up、5 次正式 samples。
- 同時測量獨立 Artifact、同 owner 的並行 mutation stress，以及跨 coordinator 的 crash-safety stress；這些 stress 不代表允許多 Cell 共寫。
- ownership guard 另以 100 次 warm-up、1000 次 samples 量測 non-owner rejection，並確認 coordinator、lease、LLM 都沒有啟動。
- 使用隔離暫存目錄、application-level warm cache、`performance.now()`；等待 Node filesystem operation 完成，但不額外 `fsync`。
- 不包含 LLM、provider network latency、HTTP/SSE/WebSocket 或 React render。

可用環境變數調整矩陣：

- `CRADLE_BENCH_OUTPUT_COUNTS`
- `CRADLE_BENCH_CELL_COUNTS`
- `CRADLE_BENCH_CONTENT_BYTES`
- `CRADLE_BENCH_WARMUPS`
- `CRADLE_BENCH_SAMPLES`
- `CRADLE_BENCH_CONTENTION_WARMUPS`
- `CRADLE_BENCH_CONTENTION_SAMPLES`
- `CRADLE_BENCH_OWNERSHIP_WARMUPS`
- `CRADLE_BENCH_OWNERSHIP_SAMPLES`
- `CRADLE_BENCH_OUTPUT`

## 測試紀錄

### 2026-08-31 — Artifact single-owner gate 消除跨 Cell 無效 mutation

狀態：ownership rejection 為 `current-state only`；Artifact I/O 與 contention 使用同機、同矩陣的 before／after
regression comparison。before 結果：
`/var/folders/xg/8d1b0g653xld375mpb6rc5k80000gn/T/cradle-artifact-benchmark-2026-08-31T14-32-44.712Z.json`；
after 結果：
`/var/folders/xg/8d1b0g653xld375mpb6rc5k80000gn/T/cradle-artifact-benchmark-2026-08-31T14-38-05.947Z.json`。

優化目標與 invariant：

- Artifact root metadata 與 authoritative `current.json` pointer 明確保存 `ownerCellId`。
- 非 owner repair 在呼叫 LLM 前拒絕；非 owner store mutation 在 coordinator 與 filesystem lease 前拒絕。
- division 的 parent／child products 仍是不同 Artifact，各自綁定 target Cell；fusion 仍只讀 parents 並由 child 建立新 Artifact。
- legacy Artifact 以既有 `context.cellId`／`origin.targetCellId` 推導 owner；矛盾 metadata 不可靜默覆蓋。
- owner 的正常 incremental path、revision CAS、validation 與 recovery 語意不變。

複雜度變化：已載入 Artifact metadata 的跨 owner mutation 從可能繼續支付 locator、prompt、LLM、queue、
`O(Δ + G + I)` mutation 與 contention wait，降為一次固定欄位集合的 `O(1)` owner compare。Cell repair 仍需先讀
bounded repair head，但在 target hydration 與 LLM 前終止。正常 owner mutation 只增加 `O(1)` policy check。

環境沿用本文件同日正式矩陣：Apple M4 Pro、48 GiB RAM、Node v20.19.2、本機 SSD、4096 bytes/output、
scaling 2+7 samples、contention 1+5 samples，無額外 `fsync`、不含 LLM。after schema v4 正式執行 21.5 秒。

#### Ownership rejection

| Samples | Reject p50 | Reject p95 | Coordinator calls | Lease calls | LLM calls |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1000 | 0.003 ms | 0.004 ms | 0 | 0 | 0 |

這是已載入 Artifact 傳入 foreign owner store 的 deterministic guard microbenchmark。另有 production-service
focused test 驗證 foreign Cell repair 的 AI 呼叫為 0，並產生 `artifact_mutation_owner_violation` metric。

#### 正常 owner path regression

| Outputs | Full save before → after | Delta before → after |
| ---: | ---: | ---: |
| 10 | 9.281 → 9.644 ms | 2.210 → 2.273 ms |
| 100 | 72.257 → 65.631 ms | 2.011 → 2.127 ms |
| 1000 | 650.055 → 648.744 ms | 1.999 → 2.038 ms |

delta p50 差異為 +2.0% 到 +5.8%；絕對差異不超過 0.116 ms。full save 在 -9.2% 到 +3.9% 間波動，
沒有顯示複雜度或 I/O amplification 改變。independent throughput 在 -12.7% 到 +20.8% 間雙向波動；16 Cell
由 894.727 增至 924.206 ops/s。有限 contention samples 下不宣稱 throughput 改善，只判定沒有隨 Cell 數放大的
一致性 regression。

same-owner 16-worker runtime stress 為 43.632 ms／366.704 ops/s；cross-coordinator stress 仍為
1186.735 ms，lease wait p95 1174 ms。後者保留為錯誤部署／crash-safety 壓力測試，不再描述成正常多 Cell
shared-Artifact 架構。

#### Correctness 與下一步

- 新增 owner canonicalization、metadata conflict、foreign store fast rejection、repair pre-LLM rejection 測試。
- 完整 server suite：124 個 test files 通過。
- 正式 non-owner proposal routing 尚未實作；下一步應把 foreign intent 寫入 owner Cell mailbox，形成
  `ArtifactChangeProposal → salience → owner activation`，而不是開放共寫。
- 跨 process 的同 owner worker 若真的需要並行，應走 single-writer IPC queue；不應以縮短 lease polling
  取代 ownership boundary。

### 2026-08-31 — Transactional ChangePlan rebase 消除 stale retry amplification

狀態：具相同硬體、矩陣、sample count、cache 與 durability 設定的 before／after 正式比較。

實作基準：`39f37bd`（benchmark 與 current-state baseline）；優化結果在其後續 working tree 量測。

優化目標與 invariant：

- 將「讀最新 head → 驗證 content hash → 套用 change plan → 驗證 Goal fidelity → promote」放進同一個 Artifact transaction。
- 不重疊 output 的 concurrent change plan 應各自只提交一次，並在最新 revision 上安全 rebase。
- 同一 output 的並行修改仍必須由 content-hash precondition 拒絕。
- 多個各自安全的 patch 合併後若會破壞 Goal fidelity，後取得 transaction 的修改必須拒絕。
- 不以 last-writer-wins、跳過 validator 或移除 filesystem lease 換取效能。

正式 after benchmark：schema v3，執行時間 21.602 秒；其餘環境與前一筆 baseline 相同。

```bash
npm run benchmark:artifact
```

#### 同 runtime 共享 Artifact before／after

| Cells | Before p50 | After p50 | Latency 變化 | Before throughput | After throughput | Throughput 變化 | Attempts / success |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 5.568 ms | 4.623 ms | -17.0% | 359.206 ops/s | 432.631 ops/s | +20.4% | 1.5 → 1.0 |
| 4 | 12.243 ms | 10.827 ms | -11.6% | 326.721 ops/s | 369.440 ops/s | +13.1% | 2.5 → 1.0 |
| 8 | 33.060 ms | 20.887 ms | -36.8% | 241.982 ops/s | 383.014 ops/s | +58.3% | 4.5 → 1.0 |
| 16 | 101.718 ms | 43.603 ms | -57.1% | 157.297 ops/s | 366.951 ops/s | +133.3%（2.33×） | 8.5 → 1.0 |

每輪 `N` 個 change plans 中會有 `N - 1` 個安全 rebase，但每個 plan 都只進 transaction 一次。Cell 數上升
後，消除 retry amplification 的收益持續增加。

複雜度由同 base revision 的總 attempts `N(N + 1) / 2 = O(N²)`，降為 `N = O(N)` 次 transaction。
單一 authoritative Artifact 仍必須序列發布 revision，因此整輪主要成本為
`O(N × (Δ + G + I))`；不同 Artifact 仍可獨立平行。

#### Independent Artifact prepared fast path

新的 contention workload 使用正式 ChangePlan transaction 路徑。若進 lock 後確認 `baseRevisionId` 仍等於
authoritative current pointer，會使用鎖外已完成的 deterministic validation 與 prepared delta；revision 已改變
時才讀最新 target output、rebase 並重新驗證。相較 baseline，獨立 Artifact throughput 如下：

| Cells | Before | After | 變化 |
| ---: | ---: | ---: | ---: |
| 2 | 788.695 ops/s | 775.332 ops/s | -1.7% |
| 4 | 965.902 ops/s | 998.253 ops/s | +3.3% |
| 8 | 940.817 ops/s | 934.148 ops/s | -0.7% |
| 16 | 937.342 ops/s | 951.380 ops/s | +1.5% |

差異在 -1.7% 到 +3.3% 之間，視為沒有可辨識的 throughput regression。prepared fast path 仍在 Artifact
transaction 內確認 authoritative pointer，沒有跳過 CAS；只有 pointer 相同才重用原本 validation evidence。

#### Cross-coordinator 結果

跨 coordinator 的 attempts 也固定為 1，但 wall latency 幾乎不變：16 Cells p50 仍為 1202.833 ms，
lease wait p95 為 1185 ms。這證明剩餘瓶頸是 filesystem lease 的 bounded exponential backoff，而不是 stale
revision retry。若 Cell AI 未來使用獨立 process，應由中央 Artifact writer／IPC durable mutation queue 接收
intent；不應讓每個 worker 直接競爭同一 Artifact filesystem lease。

#### Correctness 與 regression

- 新增並行測試：不同 output 從同一 base 提交時兩者皆保存，且其中一個明確標示 rebase。
- 新增衝突測試：同一 output 只允許一個成功，另一個由 stale content hash 拒絕。
- 新增聚合 Goal fidelity 測試：兩個 patch 合併後若移除最後 required term，只允許第一個成功。
- 修正 repair head 演進：output 已 hydrate 新內容時，以新內容判斷 Goal term，不再誤用舊 `contentTermHashes`。
- `artifact_change_plan_rebased` 與 `artifact_change_plan_conflict` 已加入正式 runtime metrics。
- `artifact_change_plan_prepared_fast_path` 記錄 CAS 命中並重用 validation evidence 的次數。
- focused Artifact tests 通過；完整 server suite 為 123 個 test files（包含新測試）。
- `git diff --check`：通過。

#### 下一個瓶頸

1. 以 process-local／IPC single writer 保證每個 Artifact 只有一個 mutation ingress，讓 filesystem lease 回到 crash-safety boundary，而不是高頻 queue。
2. 將 metadata compaction 移出 transaction critical path，降低長 revision chain 間歇性 tail latency。
3. 若確實需要多 process 直接寫共享 Artifact，再設計具公平喚醒語意的 distributed mutation adapter，而不是調低 polling 間隔掩蓋 contention。

### 2026-08-31 — Incremental Artifact 與多 Cell contention 正式基準

狀態：`current-state only`。本次建立正式可重複 benchmark，沒有相同方法產生的優化前基準；下列倍率是
同一版本內 full 與 incremental 路徑的成本差異，不是相對上一版本的改善百分比。

Runtime 基準 revision：`cbe531cb9c6d346abfc9059f6e0fe3a3a4b9dc93`
（`feat: optimize cell activation and artifact revisions`）。

測試目標：

- 驗證單一 output delta 是否隨 Artifact 總 output 數增加。
- 驗證各自擁有 Artifact 的 Cell 能否獨立平行運作。
- 區分目前單 Node runtime 的共享 coordinator，以及未來 Cell／AI worker 各自 coordinator 的共享 Artifact contention。
- 找出 stale revision、retry 與 filesystem lease 的 amplification。

環境與方法：

| 項目 | 數值 |
| --- | --- |
| CPU | Apple M4 Pro，14 logical CPUs |
| RAM | 48 GiB（51,539,607,552 bytes） |
| OS / arch | Darwin / arm64 |
| Node | v20.19.2 |
| output size | 約 4096 bytes / output |
| scaling samples | 2 warm-up + 7 samples |
| contention samples | 1 warm-up + 5 samples |
| storage | 隔離暫存目錄，本機 SSD |
| cache | explicit warm-up 後的 application-level warm cache |
| durability | Node filesystem completion；沒有額外 `fsync` |
| LLM | 不包含 |
| 正式執行時間 | 21.837 秒 |

執行命令：

```bash
npm run benchmark:artifact
```

#### Output scaling

單位為毫秒。

| Outputs | Full save p50 / p95 | Single-output delta p50 / p95 | Selective context p50 | Manifest p50 | Full read p50 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 8.905 / 9.725 | 2.229 / 2.493 | 0.503 | 0.617 | 1.234 |
| 100 | 68.386 / 74.651 | 2.014 / 2.422 | 0.525 | 0.661 | 5.995 |
| 1000 | 643.464 / 682.096 | 2.130 / 3.190 | 0.525 | 1.221 | 53.621 |

觀察：

- Full save 與 full read 隨 output 數量成長，符合必須處理完整輸出的 `O(F + B)`。
- Single-output delta 在 10 到 1000 outputs 間維持約 2.0–2.2 ms；在這個矩陣內接近 `O(Δ + G + I)`，沒有觀察到隨 `F` 線性成長。
- 1000 outputs 時，single-output delta 是同版本 full save 的約 302 倍成本差距；這是路徑比較，不是跨版本 speedup。
- 1000 outputs 時，selective context 是同版本 full read 的約 102 倍成本差距。

#### Multi-Cell contention

每格為 wall-clock p50／throughput p50。

| Cells | 各自 Artifact | 同 runtime 共享 Artifact | 跨 coordinator 共享 Artifact | 跨 coordinator lease wait p95 |
| ---: | ---: | ---: | ---: | ---: |
| 2 | 2.536 ms / 788.695 ops/s | 5.568 ms / 359.206 ops/s | 8.601 ms / 232.538 ops/s | 6 ms |
| 4 | 4.141 ms / 965.902 ops/s | 12.243 ms / 326.721 ops/s | 42.325 ms / 94.507 ops/s | 38 ms |
| 8 | 8.503 ms / 940.817 ops/s | 33.060 ms / 241.982 ops/s | 373.140 ms / 21.440 ops/s | 361 ms |
| 16 | 17.070 ms / 937.342 ops/s | 101.718 ms / 157.297 ops/s | 1192.184 ms / 13.421 ops/s | 1077 ms |

觀察：

- 各自 Artifact 的 Cell 從 4 到 16 Cells 維持約 937–966 ops/s，file lease contention 為零；目前架構適合 Cell 各自擁有狀態與產物。
- 同 runtime 共享 Artifact 沒有明顯 file lease wait，但 16 Cells 每次成功平均需要 8.5 次嘗試。多個 mutation 都從同一 base revision 建立，排隊後成為 stale，總 retry work 趨近 `O(N²)`。
- 跨 coordinator 共享 Artifact 在 16 Cells 時 p50 為 1.192 秒，lease wait p95 為 1.077 秒。bounded exponential backoff 避免 busy polling，但在 thundering herd 下成為主要延遲來源。
- 「Cell 獨立運作」本身不是瓶頸；多個 Cell 同時修改同一 authoritative Artifact 才是下一個主要瓶頸。

#### Correctness 與 regression

- 共享 Artifact 測試在每輪完成後重新讀取 authoritative Artifact，確認所有 Cell 的目標 output 都保存最新 marker。
- stale revision 必須拒絕，沒有以 last-writer-wins 換取效能。
- `npm test --workspace=cradle-server`：122 個 test files 通過。
- `git diff --check`：通過。

#### 下一個優化假設

1. Cell 將 mutation intent 送到單一 Artifact writer，writer 在 critical section 內讀取最新 revision 並套用 patch，消除 stale-retry amplification。
2. 對互不重疊的 `changedPaths` 使用 per-output revision 或 MVCC merge，讓衝突範圍從整個 Artifact 縮小到實際 output。
3. 跨 worker 使用 IPC／durable mutation queue，不讓每個 worker 直接以 filesystem lease 競爭同一 Artifact。
4. 將 metadata compaction 移出 mutation critical path，但仍維持 atomic current pointer 與可恢復性。

預期目標是把共享 Artifact mutation 從 retry amplification `O(N²)` 壓向序列 writer 的 `O(N + ΣΔ)`；
互不重疊的 output 若能安全 merge，則每筆 mutation 的主要工作維持 `O(Δ)`。

#### 限制

- 這是 Artifact persistence microbenchmark，不代表完整 Cell activation 或 LLM end-to-end latency。
- 沒有測量 provider token throughput、API rate limit、HTTP/event transport、React render、冷 cache 或明確 `fsync` durability。
- p95 使用有限 samples，適合 regression 比較，不應直接當成 production SLO。
- 未來若變更硬體、Node、filesystem、sample count 或 cache 模式，必須建立新紀錄，不可直接和本次宣稱 speedup。

### 2026-09-02 — Stimulus cultivation event coalescing 與 Node 22 sanity check

狀態：`current-state only`。Node 已由 v20 改為 v22.23.2，因此 Artifact 數值不與舊紀錄宣稱改善百分比；
presentation benchmark 的 direct-dispatch control 與 coalesced path 是同一版本、同機、同 workload 比較，
目的只在量化 subscriber/render amplification，不代表 React browser render latency。

優化目標與 invariant：

- `cell.cultivation.updated` 以 `cellId` 在同一 presentation frame 只保留最新事件。
- 同一 Cell 的 background cultivation 由 coordinator 序列執行，避免重複 claim；不同 Cell 不共用 queue key。
- `stimulus-cultivation` terminal event 不再觸發 `cells + selectedCell` REST refetch；Cell event 局部 patch 對應 state，reconnect 仍可由 REST reconciliation。
- 百分比只能來自 server lifecycle checkpoint，不能 drop terminal state 或用 client timer 製造 progress。
- 不減少 Stimulus persistence、quality gates、Artifact validation 或 provenance 工作。

複雜度：一個 frame 內有 `E` 筆 cultivation events、`C` 個受影響 Cells 時，presentation subscriber delivery
由 `O(E)` 降為 `O(C)`；queue ingestion 仍是 `O(E)`。單一 Cell 的 1000-event burst 因此只送出一次最新狀態。
operation terminal 的正常 REST amplification 由 2 個 Cell resources request 降為 0；斷線重連仍保留全域 truth reconciliation。

環境：Apple M4 Pro、14 logical CPUs、48 GiB RAM、Darwin arm64、Node v22.23.2。presentation workload 為
25 次 warm-up、200 samples、每個 sample 同一 Cell 1000 events；`performance.now()`、Node `--expose-gc`，
不含 browser layout/paint、network 與 LLM。

```bash
npm run benchmark:presentation --workspace=cradle-web
```

| Path | p50 | p95 | raw throughput | subscriber calls / 1000 events | terminal value |
| --- | ---: | ---: | ---: | ---: | ---: |
| direct-dispatch control | 0.0008 ms | 0.0438 ms | 104,472,357 events/s | 1000 | 999 |
| keyed frame coalescing | 0.0802 ms | 0.1344 ms | 11,026,294 events/s | 1 | 999 |

coalescing 本身增加 Map/queue 的 raw CPU 成本，但把可能導致 React update 的 subscriber calls 從 1000 降為 1；
這是此次要消除的 amplification。量測後 retained heap delta 為 29,384 bytes。focused test 另驗證 100 次
same-Cell updates 的 pending queue 為 1，且最後 progress 99 未遺失。

Artifact path 因新增 stimulus provenance 欄位也執行正式 sanity benchmark：

```bash
npm run benchmark:artifact
```

| Outputs | Full save p50 / p95 | Delta p50 / p95 | Selective p50 | Full read p50 |
| ---: | ---: | ---: | ---: | ---: |
| 10 | 9.189 / 9.398 ms | 2.111 / 2.283 ms | 0.493 ms | 1.132 ms |
| 100 | 76.722 / 85.238 ms | 1.938 / 2.465 ms | 0.482 ms | 5.467 ms |
| 1000 | 602.870 / 715.387 ms | 1.916 / 2.338 ms | 0.458 ms | 49.666 ms |

| Cells | Independent p50 / throughput | Same-owner p50 / throughput | Cross-coordinator p50 / lease p95 |
| ---: | ---: | ---: | ---: |
| 2 | 2.715 ms / 736.614 ops/s | 4.401 ms / 454.438 ops/s | 8.170 ms / 7 ms |
| 4 | 4.061 ms / 985.030 ops/s | 8.914 ms / 448.739 ops/s | 43.085 ms / 41 ms |
| 8 | 9.393 ms / 851.679 ops/s | 19.057 ms / 419.789 ops/s | 384.420 ms / 371 ms |
| 16 | 15.429 ms / 1036.977 ops/s | 42.940 ms / 372.612 ops/s | 1212.935 ms / 1193 ms |

ownership rejection 1000 samples p50/p95 均為 0.003 ms，coordinator、lease 與 LLM calls 都是 0。
完整結果：`/var/folders/xg/8d1b0g653xld375mpb6rc5k80000gn/T/cradle-artifact-benchmark-2026-09-02T10-47-12.069Z.json`。

限制與下一步：

- presentation 數字是 Node microbenchmark；下一步以 browser profiler 記錄 React commit count、frame time 與 network requests。
- current operation store 是 process-local；restart recovery 若加入 durable worker queue，需另量測 queue age p50/p95。
- image OCR 尚未加入，因此沒有用省略 vision work 換取效能；其 evidence outcome 明確是 `insufficient_evidence`。

### 2026-09-04 — 真實 Stimulus cultivation latency、Cell 並行與 Codex 隔離

狀態：`observational before/after`。在同一台 Apple M4 Pro、Node v22.23.2、Codex `auto` provider 與既有
26-Cell runtime 上，經由 `POST /api/v1/stimuli/files` 投入真實 payment failure 文字刺激。before 與 after
的文字及 target Cell 數不同，before 又是被安全終止的 censored sample，因此不宣稱改善百分比。

優化目標與 correctness invariant：

- operation acceptance 必須維持快速，來源 bytes、SHA-256 與 acceptance Stimulus 先成為持久化事實。
- 不同 Cell 可並行 reasoning；同一 Cell 仍由 `CellCultivationCoordinator` 序列化。
- 多 Cell operation 使用 target checkpoint 平均 progress，phase 取最慢 target，不能倒退或過早顯示完成。
- ingestion cultivation 以一次 reasoning 形成 Observation 與 durable pending Task，不同步執行第二次 Task LLM。
- Codex 純文字與 media 呼叫都使用 ephemeral read-only directory，不得直接修改 repository／Cell workspace。
- `timeouts.cultivationSeconds` 預設 60 秒，限制單次 cultivation reasoning；逾時不能被回報為 Stable。
- 不省略六個 required quality gates，不把尚未完成的 Artifact mutation 宣稱為 sufficient。

| Sample | Targets | LLM calls | Queue age | Result |
| --- | ---: | ---: | ---: | --- |
| before, high salience | 3 | 第 1 個 Cell 已進入第 2 次 call | 4 ms | 超過 180 秒仍停在 58%，未完成後安全終止 |
| after, summary-only | 3 | 0 | 2–3 ms | 24 ms，3 Cells Stable |
| after, high salience | 2 | 2，並行且每 Cell 1 次 | 2–3 ms | 17.528 秒，2 Cells Stable |

after high-salience 的 Cell LLM durations 分別為 16.985 秒與 17.508 秒；兩個 `metabolism.started` 同時在
`2026-09-04T06:30:37.625Z`，terminal time 為 `2026-09-04T06:30:55.140Z`。每個 Cell 各保存一個
pending Task，quality outcome 都是 `sufficient`，Artifact decision 都是 `not-required`。focused regression test
另以兩個受控 Cell 證明不同 key 並行，並驗證 ingestion 不會同步呼叫 `processTask()`。

before 的未隔離 Codex 曾在 repository 建立 `.cell003-validation/PaymentRetryProbe.java` 並執行現有 Artifact；
測試收束時該暫存目錄已不存在。after 未新增 repository 產物，provider test 同時驗證文字與影像請求的
`--ephemeral --sandbox read-only --skip-git-repo-check`、isolated cwd 與 cleanup。

限制與後續：

- 目前只有各一筆真實 high-salience before/after，不代表穩定的 p50/p95；需建立固定 corpus 並重複取樣。
- auto-routing 仍是 lexical policy；Living Context、Memory 與 Artifact ownership 不一致時，target 雖可能符合歷史分工，卻難以向使用者解釋。
- Codex 能由 per-request timeout 終止；其他 provider adapter 的底層取消能力仍需逐一驗證。
- 本次未量 browser FPS、React commit 或 long task；UI 體感仍需瀏覽器 trace。

### 2026-09-04 — 全域 LLM admission、真正取消與 Cell inbox 呼叫降幅

狀態：`synthetic before/after + current runtime context measurement`。這筆先隔離 scheduler、timeout 與
prompt amplification，不把 fake provider 的毫秒數當成真實模型 latency；實際 Codex 重複樣本仍需另外收集。

優化目標與 correctness invariant：

- 所有 Cell 的 LLM request 共用 FIFO admission，`runtime.llmConcurrency` 預設為 `3`；Cell identity、Task、
  Stimulus 與 Artifact ownership 不移入 scheduler。
- deadline 從 request 進入 queue 就開始，排隊不能無限等待；逾時必須傳到底層 Codex/Gemini child process、
  Ollama HTTP request 與 Copilot SDK session，並在釋放 scheduler slot 前完成終止／清理。
- `llm_queue_wait_ms` 與 `llm_duration_ms` 分別保留排隊與端到端觀測；不以丟棄 request 換取 throughput。
- Cell system prompt 保留 DNA、Memory、Vision、Environment 與 Living Context；每次代謝的 dynamic prompt
  不再重複整份靜態 context，只加入 Living Context 與 recent history/thoughts。
- `delegation` 是明確的跨 Cell Task，直接以平台指派的 Task ID 持久化；一般 message/report 仍做一次 LLM
  觀察，但不再無條件產生第二個 Task LLM。

複雜度：無界 request burst 的 provider concurrency 由 `O(R)` 限制為 `O(min(R, L))`，其中 `L` 是
`runtime.llmConcurrency`；其餘 request 進入 `O(R)` FIFO queue。代謝 prompt 的靜態 context amplification
由約 `2S + D` 降為 `S + D`。明確 delegation 的端到端 LLM calls 由 2 降為 1。

環境與命令：Apple M4 Pro、14 logical CPUs、48 GiB RAM、Darwin arm64、Node v22.23.2；12 個 request，
fake provider healthy concurrency 3、base latency 20 ms、超過容量後每 request 增加 25 ms。單次 run，
p50/p95 是該 run 的 12 筆 request samples；cache/durability 不適用，沒有 network 或真實 LLM。

```bash
npm run benchmark:llm --workspace=cradle-server
```

| Path | samples | wall | p50 | p95 | throughput | max provider concurrency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| unbounded reference | 12 | 251.9 ms | 125.4 ms | 251.8 ms | 47.6 req/s | 12 |
| bounded current | 12 | 87.8 ms | 66.3 ms | 87.7 ms | 136.7 req/s | 3 |

bounded path 的 queue wait p50/p95 為 45/65 ms。這個 overload model 下 wall latency 降 65.1%、throughput
提高 2.87 倍；這只證明 admission 在 provider 超載時的效果，不代表 Codex、Gemini、Ollama 或 Copilot
真實服務會有相同比例。

timeout scenario 使用 20 ms deadline：21.6 ms 回到 caller，隨後立即觀察到 provider running `0`、scheduler
running `0`。provider focused tests 另讓 Codex/Gemini fake CLI 忽略 `SIGTERM`，確認 250 ms 後以 `SIGKILL`
收束；Ollama AbortSignal 到達 fetch，Copilot session listener 被移除且 session dispose 完成。

Cell-to-Cell delegation benchmark 使用相同 20 ms fake model latency：current path 為 1 次 LLM、21.9 ms；
舊的 inbox summary → generated Task path 為 2 次 LLM、41.1 ms。兩者都形成 1 個 durable Task，因此沒有以
省略委派工作換取速度。一般資訊若模型判斷不需 Task，現在停在一次觀察，不再固定放大成第二次呼叫。

現有 runtime data 的 prompt 字元量（system + dynamic）也以相同 revision 直接量測：

| Cell | Before | After | 變化 |
| --- | ---: | ---: | ---: |
| cell-003 | 28,792 | 21,717 | -24.6% |
| cell-022 | 21,665 | 14,227 | -34.3% |

#### 真實 Codex current-state 驗證

同一台機器與 Node v22.23.2 上，透過 live API 投入一份包含 payment retry failure、duplicate charge risk、
idempotency validation 與 transaction evidence 的文字 Stimulus。初次 lexical routing 因長文分母稀釋且沒有拆解
camelCase/path token，17 ms 內收斂為 `needs_attention`，沒有呼叫 LLM；這是 routing correctness failure，不能當成
低 latency 成功。修正為 bounded 12-term denominator 並拆解 camelCase/path 後，operation
`op-6d80f050-92d4-4e75-b44b-99099eccf525` 的 acceptance latency 為 4.921 ms，三個 target 同時進入 cultivation：

| Cell | LLM queue wait | LLM duration | 結果 | Durable Task |
| --- | ---: | ---: | --- | ---: |
| cell-002 | 0 ms | 17,500 ms | Stable / sufficient | 1 |
| cell-001 | 0 ms | 18,928 ms | Stable / sufficient | 1 |
| cell-004 | 0 ms | 60,010 ms | needs_attention / error（60 秒 timeout） | 0 |

operation 端到端為 60,037 ms；terminal metrics 為 `llm_running=0`、`llm_queue_depth=0`，證明 timeout 已傳到
provider 並釋放 admission slot，而不是 caller 先返回、模型仍在背景執行。三個 Cell 的
`metabolism.started` 相差 1 ms，證明不同 Cell 沒有再彼此串行等待。這是一筆 current-state sample，不足以代表
Codex p50/p95。

這筆 live sample 同時暴露出 platform nouns 與 Living Context exclusion 沒有參與 lexical routing，導致上游
commerce Cell 也支付一次 LLM。後續同 slice 的 deterministic refinement 排除 `Cradle`／`Cell`／`Artifact`
等平台通用詞、把 Living Context `excludes` 視為負向 ownership evidence，並以 9-term minimum denominator
保證至少兩個可解釋的領域詞才能自動路由。代表性 policy test 讓上游與 owner 候選收斂為唯一 payment owner；因為沒有
在相同 live corpus 重跑付費模型，此處只記 correctness／expected amplification change，不宣稱實測 latency
改善。

#### Correctness 與 regression

- 12/12 requests 都完成，bounded path 最大 provider concurrency 符合 3。
- deadline 包含 queue wait；尚未取得 slot 的 request 可取消並從 queue 移除。
- delegation Task 保存 message ID、來源 Cell、時間與原始內容；平台仍指派 authoritative Task ID。
- message/report 的模型輸出只形成 Observation 與最多 1 個 Task，並保留 inbox receipt provenance。
- server 完整 suite（含 scheduler、prompt、provider cancellation、inbox 與 routing/salience slice）為
  141 個 test files，全部通過。

#### 限制與下一步

- synthetic overload penalty 用來固定重現資源飽和，不代表特定 provider 的 capacity curve。
- `runtime.llmConcurrency=3` 是安全起點；應分別用 Codex remote 與 Ollama local corpus 量 p50/p95、tokens/s、
  rate limit、RSS/GPU memory 後再調整，不能直接提高 concurrency。
- 知識檔仍是完整載入 system prompt；長期需要可追溯的 relevance retrieval／summary compaction，不能直接
  截斷 durable Memory。
- 這次真實 sample 對一個問題啟動 3 次 LLM，顯示跨 Cell 重複 Observation/Task 已取代 scheduler 成為主要
  amplification；下一個 server slice 應量 `llm_calls / unique issue fingerprint`，再決定 primary owner 與
  secondary summary-only／delegation policy。不能用固定只選一個 Cell 換取速度，因為跨 boundary Stimulus
  仍可能具有多個必要 owner。

### 2026-09-04 — 明確 Artifact production stimulus 的單次 LLM 路徑

狀態：`current-state only`。本次沒有保存相同 revision 前的可比較 benchmark，因此不宣稱改善百分比。

目標路徑為 Incubator `[+]` → `POST /api/v1/stimuli/files` → extraction → deterministic Cell routing →
`StimulusCultivationService` → `ArtifactProductionService`。使用者明確提供 Artifact Type 時，primary Cell 在記錄
Memory 與歸檔該 Stimulus 後直接進入既有 `Generate → Parse → Normalize → Validate → Repair → Store`；不再先讓
metabolism 產生另一個 Task 再等待後續週期。secondary Cell 只摘要吸收，不重複生產。

預期 amplification 從每一明確生產要求可能支付 metabolism LLM 加 production LLM，收斂為 primary 的一次
production LLM。routing 與 Cell 描述仍為 `O(C)`，C 是 Cell 數；單一 Cell 的直接生產 orchestration 為 `O(1)`。
不可破壞的不變量是：Stimulus/Source provenance 必須進入 Artifact、只有 primary 生產、secondary 仍保存必要
context、未通過驗證的 output 不得持久化、未指定 Type 時不得猜測或自動生產。

環境：Apple M4 Pro、Darwin arm64、Node v22.23.2。benchmark 使用 5 次 warm-up、40 次正式 sample、單一 Cell、
固定 10 ms fake provider、fake persistence、無 network、cache 不適用。p50/p95 是 40 次完整 cultivation orchestration
samples；CPU 與 RSS 是整批量測。

```bash
npm run benchmark:stimulus-production --workspace=cradle-server
```

| samples | p50 | p95 | wall | throughput | production calls | metabolism calls | LLM calls / Artifact | CPU | RSS delta |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 40 | 11.113 ms | 11.432 ms | 444.016 ms | 90.087 ops/s | 40 | 0 | 1 | 6.77 ms | 802,816 B |

Correctness evidence：focused tests 驗證明確 Type metadata 與 `/produce` directive 不受 Goal 語言影響、自然語言
關鍵字不會決定 Type、未知 Type/影片被拒絕、direct production 不呼叫 metabolism、Stimulus 被歸檔、Source 與
Stimulus provenance 被保留、Artifact completion 會觸發 Creations reconciliation。SVG image 另驗證禁止 script、
foreignObject、event handler 與外部資源。

限制：fake provider 數據只量 orchestration overhead 與 call amplification，不代表任何真實 LLM latency、token
throughput、filesystem durability 或網路表現。真實 provider 的 p50/p95 必須用同一組 Goal corpus 分別量測；目前
最大延遲仍預期來自 production LLM 與 bounded repair，而不是 Type selection。

#### 真實 Codex current-state 驗證與 timeout 缺陷

第一次 live run（operation `op-3817f0a9-b65d-46ac-ab1f-3235af85a37d`）揭露 production 仍使用
`ai.timeoutSeconds=3600`：從 2026-09-04T09:22:59.752Z 到 10:03:53Z 仍停在 `producing`，超過 40 分鐘後人工
終止測試 server。這不是成功 sample，也不是 latency 改善；它證明 `/produce` 沒有受到 60 秒 cultivation budget
約束。修正後一次 production（包含最多一次 validation repair）共用 `timeouts.cultivationSeconds` 的總 deadline，
剩餘 budget 才傳給每次 `askWithTimeout`，避免兩次呼叫各自取得完整 timeout。

修正後以 110-byte English Goal、明確 `artifactType=spec`、固定 `cell-002` 重跑。operation
`op-e29dd855-74fa-4bcf-9a81-9368cb2fc8f5` 從 2026-09-04T10:05:44.973Z 到 10:06:19.021Z，在
34.048 秒完成並建立 `artifact-20260904-180619`；operation context 保留 Type 與 metadata mode，Creations API
可立即讀到該 Artifact，Source/Stimulus/revision provenance 完整。這是單一 current-state sample，不是 p50/p95。

產物的格式與 lineage gates 通過，但模型在文件內容中自行列出的 supported-type subset 不完整；目前沒有針對該
spec Goal 的獨立 semantic oracle，因此這筆結果不能證明內容已達 declared-purpose sufficient quality。後續若要自動
publish 此類規格，必須新增版本化 Quality Contract 與可重現的 catalog-consistency indicator，不能以模型文字流暢度
或基本 Markdown validation 代替。

### 2026-09-04 — Incubator 連續 Stimulus feed queue

目標路徑為 Incubator composer／workspace drop → `useIncubatorFeed` → `StimulusFeedQueue` →
`POST /api/v1/stimuli/files`。先前 `feedFiles` 在 browser 逐一 `await` 每個 upload，整批結束前 composer disabled，且
單一 `acceptedOperation` 會讓後一份刺激覆蓋前一份的可見進度。現在所有輸入同步進入可見 feed queue，composer 立即
恢復可用；browser 最多並行送出兩份，server 接受後每份 operation 獨立訂閱 authoritative runtime state。

複雜度：N 份檔案、單次 upload latency L 下，舊 input blocking／drain 約為 `O(NL)`；新 input release 為 `O(N)`
建立輕量 queue records，background drain 約為 `O(ceil(N/2)L)`，queue memory 為 `O(N)`。server routing、Stimulus
持久化與 Cell ownership semantics 不變。REST 接受後立即釋放 browser Blob，避免 LLM 執行期間保留大型 payload。

環境與命令：Apple M4 Pro、14 logical CPUs、48 GiB RAM、Darwin arm64、Node v22.23.2；12 samples，每 sample
20 個 stimulus，固定 3 ms fake upload，queue concurrency 2，無 network、cache 與 durability。p50/p95 是 composer
可再次接受輸入前的 caller blocking time；throughput 是全部 240 個 fake uploads 的 drain rate。

```bash
npm run benchmark:feed --workspace=cradle-web
```

| Path | samples × files | input release p50 | input release p95 | wall | throughput | CPU | RSS delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sequential reference | 12 × 20 | 68.010 ms | 68.442 ms | 813.701 ms | 294.949 files/s | 8.332 ms | 163,840 B |
| bounded feed queue | 12 × 20 | 0.067 ms | 0.191 ms | 409.846 ms | 585.585 files/s | 12.973 ms | 5,832,704 B |

在這個固定 synthetic workload，input release p95 降 99.7%，background drain throughput 為 1.99 倍。這只證明
移除 browser sequential await 與 concurrency 2 的預期效果，不代表真實檔案、network、extraction、Cell routing 或
LLM 的相同比例。RSS delta 包含 V8 為 240 個可追蹤 queue/operation records 保留及擴張的 heap pages；本次不宣稱
記憶體改善，真實 browser 長時間 soak test 必須另量 retained heap。

Correctness invariants：Cell 選擇仍由 server Living Context routing 決定；queue 只表示尚未被 REST 接受的材料，不是
第二份 lifecycle authority；每份 stimulus 保存當下明確選擇的 Artifact Type；upload failure 保留原檔並可重試同一
feed record；REST accepted 後不再從 browser 重送；terminal event 不會被較晚的 HTTP 202 snapshot 倒退。UI 以真實
operation phase 與 timestamp 顯示 elapsed time，不合成 timer progress。

### 2026-09-04 — Stimulus cultivation 端到端取消

目標路徑為 Incubator activity card → `POST /api/v1/operations/:operationId/cancel` → `OperationRunner` →
extraction／Cell coordinator／metabolism／Artifact production／provider adapter。先前已接受的 cultivation 無法由使用者
停止；卡住或已不需要的 LLM 工作會繼續占用全域 admission slot 與同一 Cell 的序列 queue。現在 operation 會先進入
`cancelling`，待正在執行的工作完成取消補償後成為 `cancelled`。尚未開始的同 Cell operation 可立即回應取消，但仍由
內部 queue tail 保持 ordering，不讓後續工作越過它。

複雜度：取消查找與 AbortSignal propagation 為 `O(1)`；同一 Cell 的既有 serialization 與 queue memory `O(Q)` 不變。
Artifact revision 是 commit boundary：signal 在權威寫入前中止；若 revision 已成功寫入，completion 優先，避免
operation terminal state 與實際 Artifact 不一致。`cancelled` 不增加成熟度、不形成品質判定，也不等同 Stable 或
Needs Attention。

環境與命令：Apple M4 Pro、14 logical CPUs、48 GiB RAM、Darwin arm64、Node v22.23.2；10 warmups、100 samples，
in-process abort-aware fake task、in-memory operation store，無 network、cache、disk durability 或真實 provider process。

```bash
npm run benchmark:cancel --workspace=cradle-server
```

| Measurement | samples | p50 | p95 | max active calls | remaining calls | remaining controllers | CPU | RSS delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cancel request → terminal `cancelled` | 100 | 0.007 ms | 0.010 ms | 1 | 0 | 0 | 2.096 ms | 327,680 B |

這是 **current-state only** measurement，沒有可比較的 pre-change cancellation baseline，也不代表真實 Codex、Gemini、
Ollama 或 Copilot 的 process／network shutdown latency。既有 provider cancellation tests 分別驗證 CLI terminate/kill、
fetch AbortSignal 與 session disposal；本 benchmark 只驗證 application cancellation propagation 不累積 active calls 或
operation controllers，因此不宣稱真實 provider latency 改善比例。

Correctness invariants：REST operation state 仍是 authority；runtime event 只通知 presentation；已排隊和執行中的工作
不會破壞同一 Cell ordering；取消必須先完成 Cell state 與 lifecycle event 補償才 terminal；取消後不保存未 commit 的
Artifact；晚於 authoritative revision 的取消不能把已存在的產物偽裝成 cancelled；每個 operation controller 在 terminal
後移除。

### 2026-09-04 — SQLite operation metadata persistence

這是 Persistent Layer 的第一個切片：API runtime 將 operation metadata 與 Cell cultivation state 寫入 SQLite WAL，保留
既有 store ports，並在 server restart 時把無法安全恢復的 `accepted`／`running`／`cancelling` operation 標成
`OPERATION_INTERRUPTED`。既有 `cultivation-state.json` 會在該 Cell 首次讀取時 migration；API process 之後以 SQLite row
為 state authority。
Cell、Source、Memory 與 Artifact 的大型內容仍留在既有 file/blob stores；本次沒有宣稱 cultivation latency 改善。

環境與命令：Apple M4 Pro、Darwin arm64、Node v22.23.2；200 samples，每筆執行 create + running update + completed update，
events disabled；SQLite 為 WAL + `synchronous=NORMAL`，無 LLM、network 或大型內容 I/O。

```bash
npm run benchmark:persistence --workspace=cradle-server
```

| Path | samples | p50 | p95 | total |
| --- | ---: | ---: | ---: | ---: |
| in-memory operation store | 200 | 0.003 ms | 0.012 ms | 2.154 ms |
| SQLite WAL operation store | 200 | 0.092 ms | 0.138 ms | 21.081 ms |

這是 **current-state only** measurement，沒有 pre-change durability baseline；結果顯示 operation metadata 的 SQLite
寫入成本明顯高於 in-memory，但仍屬短 metadata transaction，不可外推到完整 cultivation latency。這個切片只宣稱
durability/resume correctness 改善，不把 SQLite 寫入成本當成效能提升。Correctness invariants：重開後 terminal operation payload 可讀回；in-flight operation 不會假裝
自動續跑；Cell cultivation 的 interrupted state 仍進入既有 needs-attention reconciliation。

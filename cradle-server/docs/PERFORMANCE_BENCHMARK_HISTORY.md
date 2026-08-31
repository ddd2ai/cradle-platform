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
- 同時測量獨立 Artifact、單一 runtime 共用 coordinator 的共享 Artifact，以及跨 coordinator 的共享 Artifact。
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
- `CRADLE_BENCH_OUTPUT`

## 測試紀錄

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

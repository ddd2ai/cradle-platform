# Cradle Platform Testing

## 目錄結構

```
test/
├── stimuli/           # 刺激生成腳本
│   ├── generate-all.sh
│   ├── generate-perception.sh
│   ├── generate-decision.sh
│   ├── generate-decomposition.sh
│   ├── generate-learning.sh
│   ├── generate-collaboration.sh
│   ├── generate-creation.sh
│   ├── generate-evolution.sh
│   └── generate-reflection.sh
│
├── colony/            # Colony 測試腳本
│   ├── stress-test.sh
│   ├── specialization-test.sh
│   └── evolution-test.sh
│
└── README.md
```

## 使用方式

### 生成測試刺激

首次使用需要設定執行權限：

```bash
chmod +x test/stimuli/*.sh
```

生成所有刺激：

```bash
./test/stimuli/generate-all.sh
```

或單獨生成特定類型：

```bash
./test/stimuli/generate-perception.sh
./test/stimuli/generate-decision.sh
# ...
```

### DNA 分化測試流程

1. 生成刺激：

```bash
./test/stimuli/generate-all.sh
```

2. 啟動所有 Cells：

```text
/activate-all
```

3. 觀察 Colony 狀態：

```text
/watch
/colony-dna
```

4. 等待 Evolution：

每個 Cell 累積 5 個 thoughts 後會自動觸發 evolution。

### 刺激分類

每種刺激對應特定 DNA trait：

- **perception**: 環境感知、弱信號偵測
- **decision**: 決策、權衡、優先序
- **decomposition**: 拆解、分析、模組化
- **learning**: 學習、模式發現、記憶
- **collaboration**: 協作、溝通、協調
- **creation**: 創造、設計、產出
- **evolution**: 演化、適應、優化
- **reflection**: 反思、總結、評估

### 觀察重點

使用 `/colony-dna` 觀察：

1. **Dominant DNA 分布**：各 Cell 的主導 DNA 是否開始分化？
2. **Score 趨勢**：整體分數是否提升？
3. **Specialization**：是否出現明確的專業化分工？

### 預期結果

經過多輪 evolution 後：

- Cell-001 可能專精 PERCEPTION
- Cell-002 可能專精 DECISION
- Cell-003 可能專精 DECOMPOSITION
- Cell-004 可能專精 LEARNING
- Cell-005 可能專精 COLLABORATION

## Colony 測試腳本（待建立）

### stress-test.sh

壓力測試，快速生成大量刺激。

### specialization-test.sh

專業化測試，針對特定 Cell 灌入特定類型刺激。

### evolution-test.sh

演化測試，觀察 DNA drift 收斂過程。

## 注意事項

- 每次 `generate-all.sh` 會**覆蓋**現有刺激
- 建議先執行 `/deactivate-all` 再生成新刺激
- Evolution 需要累積足夠 thoughts（預設 5 個）
- DNA drift 限制在 ±0.05，避免劇烈變化
- 使用 `/watch` 可即時監控 tick 處理進度

## 下一步

1. 建立 `colony/*.sh` 測試腳本
2. 加入 metrics 收集與分析
3. 建立 DNA 演化軌跡可視化
4. 設計 Cell 間協作場景測試

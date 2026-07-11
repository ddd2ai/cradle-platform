# Cradle Mathematical Model

> Cradle DNA Maturity, Division, Fusion, and Lifecycle Decision Model

## 1. 文件目的

本文說明 Cradle Platform 中，Cell 如何透過 DNA 向量的時間序列資料，計算成熟度，並進一步判斷 Cell 應該進入以下哪一種生命週期行為：

```text
Stay      維持 / 繼續成長
Repair    修復 / 穩定化
Divide    分裂
Fuse     合併
```

Cradle 的目標不是單純用次數、分數或人工規則判斷 Cell 是否成熟，而是使用經典統計方法與多變量分析，建立可解釋、可驗證、可擴充的數理模型。

---

## 2. 核心觀點

Cradle 中的 Cell 不是因為「做了很多次任務」而成熟。

Cell 的成熟，應該來自於：

```text
反覆產出
反覆執行
反覆觀察
反覆修復
反覆演化
```

之後，其 DNA 狀態逐漸穩定收斂。

因此：

```text
Maturity 不是經驗值。
Maturity 是 DNA 向量在時間序列中的低變異收斂程度。
```

也就是：

```text
DNA 越穩定，成熟度越高。
DNA 越震盪，成熟度越低。
```

---

## 3. DNA Vector 定義

Cradle 的 DNA 由八個 trait 組成：

```text
PERCEPTION
DECISION
DECOMPOSITION
LEARNING
COLLABORATION
CREATION
EVOLUTION
REFLECTION
```

每一個時間點的 DNA 狀態，可以表示成一個八維向量：

```text
Vt = [
  PERCEPTION,
  DECISION,
  DECOMPOSITION,
  LEARNING,
  COLLABORATION,
  CREATION,
  EVOLUTION,
  REFLECTION
]
```

其中 `Vt` 代表第 `t` 次 DNA 快照。

因此，DNA history 可以被視為一組多變量時間序列樣本：

```text
V1, V2, V3, ..., Vn
```

每一個 `Vi` 都是一筆八維樣本。

---

## 4. Trait Value 計算

每個 DNA trait 由以下 factors 組成：

```text
strength
stability
plasticity
fitness
```

每個 trait 的數值可以透過以下公式計算：

```text
traitValue = strength × fitness × sqrt(stability) / plasticity
```

語意如下：

```text
strength    能力強度
fitness     對目前環境的適應度
stability   穩定性修正
plasticity  可塑性 / 波動成本
```

因此：

```text
traitValue 越高，代表該 trait 在目前 Cell 狀態下越有效。
```

每個 DNA snapshot 都會被轉換成一組 trait scores，形成八維能力向量。

---

## 5. DNA Temporal Variance

### 5.1 平均 DNA 向量

給定最近 `n` 筆 DNA 向量：

```text
V1, V2, ..., Vn
```

先計算平均向量：

```text
μ = (1/n) Σ Vi
```

其中：

```text
μ = 最近一段時間 DNA 狀態的中心位置
```

---

### 5.2 到平均向量的平均平方距離

接著計算每一筆 DNA 向量相對於平均向量的平方距離：

```text
||Vi - μ||²
```

最後對所有樣本取平均：

```text
TemporalVariance = (1/n) Σ ||Vi - μ||²
```

這個值代表：

```text
最近幾次 DNA 狀態，平均偏離中心位置多少。
```

如果 `TemporalVariance` 很小，表示 DNA 向量穩定。

如果 `TemporalVariance` 很大，表示 DNA 向量仍在震盪。

---

## 6. 多變量分析意義

這個方法屬於經典多變量分析中的總變異量概念。

它等價於：

```text
trace(Covariance Matrix)
```

也就是：

```text
各個 DNA 維度變異數的總和
```

換句話說：

```text
TemporalVariance
= DNA 多維時間序列的總波動量
```

因此這個方法不是玄學指標，而是經典統計方法在 Cradle DNA 模型上的應用。

---

## 7. Convergence 收斂度

TemporalVariance 越小，代表 Cell 越穩定。

因此可以定義收斂度：

```text
Convergence = 1 / (1 + TemporalVariance)
```

語意如下：

```text
TemporalVariance 越小
  → Convergence 越接近 1

TemporalVariance 越大
  → Convergence 越接近 0
```

---

## 8. DNA Magnitude 能力量

除了穩定性之外，Cell 還需要具備足夠的能力量。

DNA magnitude 可以用八維 trait vector 的向量長度表示：

```text
Magnitude = ||Vcurrent||
```

也就是：

```text
Magnitude = sqrt(
  PERCEPTION² +
  DECISION² +
  DECOMPOSITION² +
  LEARNING² +
  COLLABORATION² +
  CREATION² +
  EVOLUTION² +
  REFLECTION²
)
```

接著將 magnitude 正規化：

```text
NormalizedMagnitude = clamp(Magnitude / MaxMagnitude, 0, 1)
```

---

## 9. DNA Maturity 成熟度

Cradle 的成熟度由兩部分組成：

```text
能力量
穩定收斂度
```

因此定義：

```text
Maturity = NormalizedMagnitude × Convergence
```

也就是：

```text
Maturity = NormalizedMagnitude × 1 / (1 + TemporalVariance)
```

語意如下：

```text
能力強，但波動大
  → 還不成熟

能力弱，但很穩定
  → 穩定但能力不足

能力強，而且波動小
  → 成熟
```

---

## 10. Maturity State

成熟度可以分為以下狀態：

```text
0.00 ~ 0.30   seed
0.30 ~ 0.60   growing
0.60 ~ 0.75   stable
0.75 ~ 0.90   mature
0.90 ~ 1.00   saturated
```

對應意義：

```text
seed       樣本不足或能力尚未形成
growing    正在成長與調整
stable     已經穩定，但未必適合分裂
mature     成熟，可以進入結構性判斷
saturated  高度成熟，可能需要分裂或重組
```

---

## 11. Cross Trait Variance

TemporalVariance 用來判斷：

```text
同一個 Cell 的 DNA 是否隨時間穩定
```

CrossTraitVariance 則用來判斷：

```text
同一時間點，八個 DNA trait 之間是否分散
```

如果 CrossTraitVariance 高，代表 Cell 的能力分布不平均，可能形成明確主軸。

例如：

```text
CREATION 明顯高於其他 trait
DECOMPOSITION 明顯高於其他 trait
```

這表示 Cell 可能已經專化。

如果 CrossTraitVariance 低，代表八個 trait 分布平均，Cell 偏向泛化。

因此：

```text
CrossTraitVariance 高
  → 專化明確，適合分裂

CrossTraitVariance 低
  → 泛化穩定，可能適合合併
```

---

## 12. Lifecycle Decision Model

Cradle 的生命週期判斷主要依據以下指標：

```text
sampleSize
maturity
temporalVariance
normalizedMagnitude
crossTraitVariance
hasComplementaryCell
recentFailureRate
```

判斷順序如下：

```text
先看樣本數是否足夠
再看 DNA 是否穩定
再看能力量是否足夠
再看 trait 分布是專化還是泛化
最後看 Colony 中是否存在互補 Cell
```

---

## 13. Stay 判斷

Cell 應該 stay 的情況：

```text
sampleSize < 5
```

表示 DNA history 樣本不足，不適合做統計判斷。

或：

```text
maturity < 0.60
```

表示 Cell 尚未成熟。

或：

```text
0.08 < temporalVariance <= 0.20
```

表示 Cell 正在成長與調整，尚未穩定到足以改變生命結構。

Stay 的語意是：

```text
不分裂
不合併
繼續觀察、代謝、修復與演化
```

---

## 14. Repair 判斷

Cell 應該 repair 的情況：

```text
temporalVariance > 0.20
```

表示 DNA 向量仍然高度震盪。

或者：

```text
recentFailureRate > 0.30
```

表示近期產物或執行結果失敗率過高。

Repair 的語意是：

```text
Cell 尚未穩定，不應該分裂或合併。
應該優先修復自身能力、產物品質或環境適應狀態。
```

---

## 15. Divide 判斷

Cell 應該 divide 的情況：

```text
sampleSize >= 5
maturity >= 0.75
temporalVariance <= 0.08
normalizedMagnitude >= 0.60
crossTraitVariance >= 0.04
```

語意如下：

```text
樣本數足夠
DNA 已經穩定
能力量足夠
成熟度達標
trait 分布呈現明確主軸
```

簡化說：

```text
穩定 + 有力 + 有方向
  → 分裂
```

Divide 代表：

```text
Cell 已經形成穩定專化能力，可以將主導能力軸投影成新的 child cell。
```

---

## 16. Fuse 判斷

Cell 應該 fuse 的情況：

```text
sampleSize >= 5
maturity >= 0.60
temporalVariance <= 0.10
normalizedMagnitude >= 0.45
crossTraitVariance < 0.04
hasComplementaryCell = true
```

語意如下：

```text
Cell 已經穩定
具備一定能力量
但 trait 分布較平均
沒有明確專化主軸
同時 Colony 中存在互補 Cell
```

簡化說：

```text
穩定但泛化 + 有互補對象
  → 合併
```

Fuse 代表：

```text
Cell 不一定適合獨立分裂，但可以與其他互補 Cell 形成更完整的能力結構。
```

---

## 17. Lifecycle Decision Table

| 條件                                                                                      | 狀態     | 行為       |
| --------------------------------------------------------------------------------------- | ------ | -------- |
| `sampleSize < 5`                                                                        | 樣本不足   | `stay`   |
| `temporalVariance > 0.20`                                                               | DNA 震盪 | `repair` |
| `maturity < 0.60`                                                                       | 尚未成熟   | `stay`   |
| `maturity >= 0.75` 且 `temporalVariance <= 0.08` 且 `crossTraitVariance >= 0.04`          | 穩定專化   | `divide` |
| `maturity >= 0.60` 且 `temporalVariance <= 0.10` 且 `crossTraitVariance < 0.04` 且有互補 Cell | 穩定泛化   | `fuse`  |
| 其他                                                                                      | 正常成長   | `stay`   |

---

## 18. 行為總結

### 18.1 分裂

```text
分裂 = 穩定專化
```

當 Cell 的 DNA 時間序列低變異，能力量足夠，且 trait 分布出現明確主軸時，Cell 可以分裂。

### 18.2 合併

```text
合併 = 穩定泛化 + 互補
```

當 Cell 已經穩定，但沒有明確專化方向，且存在互補 Cell 時，Cell 可以合併。

### 18.3 維持

```text
維持 = 樣本不足 / 尚未成熟 / 正在成長
```

當 Cell 尚未累積足夠樣本、DNA 尚未收斂，或能力量不足時，不應該急著改變生命結構。

### 18.4 修復

```text
修復 = 高震盪 / 高失敗率
```

當 Cell DNA 波動過高，或近期產物失敗率過高時，應該優先修復，而不是分裂或合併。

---

## 19. 初版門檻值

初版可以使用以下門檻：

```text
Minimum Sample Size      = 5
Divide Maturity          = 0.75
Fuse Maturity           = 0.60
Divide TemporalVariance  = 0.08
Fuse TemporalVariance   = 0.10
Repair TemporalVariance  = 0.20
Divide Magnitude         = 0.60
Fuse Magnitude          = 0.45
Specialization Variance  = 0.04
Failure Repair Rate      = 0.30
```

這些門檻不是永久固定值，未來可以根據 Cradle 的實際運作資料調整。

---

## 20. Methodology Summary

Cradle 的生命週期判斷可以總結為：

```text
DNA History
  ↓
Multivariate Time Series
  ↓
Mean Vector
  ↓
Temporal Variance
  ↓
Convergence
  ↓
DNA Maturity
  ↓
Lifecycle Decision
  ↓
Stay / Repair / Divide / Fuse
```

核心原則：

```text
Maturity 使用 temporal variance 判斷穩定性。
Division 使用 specialization 判斷主軸。
Fuse 使用 complementarity 判斷互補性。
Stay 保留成長空間。
Repair 處理高震盪與高失敗率。
```

---

## 21. 實作建議

建議將模型拆成以下檔案：

```text
src/dna/dna-maturity.js
src/dna/dna-lifecycle.js
```

其中：

```text
dna-maturity.js
  負責計算 maturity、variance、convergence、magnitude。

dna-lifecycle.js
  負責根據 maturityInfo 與 colony 狀態，判斷 stay / repair / divide / fuse。
```

CradleCell 應該只負責呼叫：

```text
getMaturityInfo()
decideLifecycle()
```

而不應該把統計公式與生命週期規則直接寫死在 Cell 內部。

---

## 22. 未來擴充方向

後續可以逐步加入更完整的多變量分析方法：

```text
PCA / SVD
  用於分裂主軸判斷

Eigenvalue Ratio
  用於判斷專化程度

Mahalanobis Distance
  用於判斷 DNA 狀態是否異常偏離

Clustering
  用於判斷 Colony 中哪些 Cell 適合合併

Weighted Centroid
  用於 Cell fusion

Covariance Structure
  用於分析 trait 之間是否共同變動
```

Cradle 不需要一開始就使用所有方法。

第一階段只要先穩定建立：

```text
Mean Vector
Temporal Variance
Convergence
Maturity
Lifecycle Decision
```

即可形成足夠穩固的數理基礎。

---

## 23. 結論

Cradle 的 Cell maturity 不應該是人工累加的經驗值，而應該是 DNA 多維時間序列的統計結果。

因此：

```text
Cell 成熟度
= DNA 能力量 × DNA 收斂度
```

也就是：

```text
Maturity = NormalizedMagnitude × 1 / (1 + TemporalVariance)
```

在這個基礎上：

```text
穩定專化 → 分裂
穩定泛化 → 合併
不穩定 → 修復
樣本不足或成長中 → 維持
```

這使 Cradle 的生命週期行為不再只是工程規則，而是建立在經典統計與多變量分析之上的數理模型。

Cradle 因此可以逐步從軟體工程平台，推進到具備數理基礎的 Software Life Engineering 平台。

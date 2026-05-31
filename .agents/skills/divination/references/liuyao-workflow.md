# Liuyao Workflow（固定順序）

## 0. Input Check

- **⏰ 先取得當前時間**（用於時機層分析參照）
- 必要輸入：`question`, `yongShenTargets`
- 可選輸入：
  - `method` — `auto`（預設自動起卦）/ `select`（選卦模式）
  - `hexagramName` — 選卦模式下：卦名（如「天火同人」）或 6 位卦碼（如「101111」）
  - `changedHexagramName` — 選卦模式下：變卦名或卦碼（可選，提供後自動計算變爻）
  - `date` — 占卜日期（ISO 格式），預設今天
  - `seed` — 隨機種子，固定後可重現結果
- 問題必須單一且可驗證（時間/目標明確）
- 複雜問題先拆分，不做混題斷卦
- `yongShenTargets` 語意判斷參考：

| 用神目標 | 適用問題範疇                                   |
|----------|----------------------------------------------|
| `父母`   | 合同文書、證件、學業考試、房屋車輛、長輩       |
| `官鬼`   | 功名求官、工作事業、規則法律、壓力風險、疾病   |
| `兄弟`   | 同輩關係、合作夥伴、競爭對手                   |
| `妻財`   | 感情婚姻、錢財收入、資源取得                   |
| `子孫`   | 子女後輩、醫藥治療、娛樂休閒、學生/下屬        |

## 1. 卦象層

- 從 output 擷取：
  - `hexagramName` / `changedHexagramName` → 本卦/變卦
  - `hexagramGong` / `hexagramElement` → 卦宮/五行
  - `guaCi` / `xiangCi` → 卦辭/象辭（輔助理解）
  - `ganZhiTime` → 占卜干支時間
  - `kongWang` → 旬空地支
- 標註是否 `liuChongGuaInfo.isLiuChongGua`（六沖卦）
- 檢查 `sanHeAnalysis`（三合局 / 半合）
- 檢查 `globalShenSha[]`（整盤級神煞）

## 2. 用神層（Mandatory）

- 使用 `yongShen[]` 分組列表分析：
  - `targetLiuQin` → 目標六親
  - `candidates[0]` 為主用神，其後為候選
  - 每個候選含 `strengthScore`, `isStrong`, `movementState`, `kongWangState`, `factors[]`
- 結合 `shenSystemByYongShen[]` 分析：
  - `yuanShen`（原神）→ 輔助用神的力量
  - `jiShen`（忌神）→ 克制用神的力量
  - `chouShen`（仇神）→ 生忌神的力量
- 比較候選強弱（旺衰、動靜、空破、受生受克）
- 若用神不在卦中，檢查 `fuShen[]`（伏神）：含 `isAvailable` 與 `availabilityReason`

## 3. 結構關係層

- 分析世應關係（透過 `fullYaos[].isShiYao` / `isYingYao` 定位）
- 分析動爻與變爻（`fullYaos[].isChanging` + `changedYao`）：
  - `changedYao.relation` → 變爻關係（回頭克/回頭生/化進/化退等）
  - `changedYao.liuQin` / `wuXing` → 變出六親/五行
- 參考 `fullYaos[].liuShen`（六神）輔助判斷事態特質
- 參考 `fullYaos[].changSheng`（十二長生）輔助旺衰定位
- 判斷關鍵阻力來源（時間、人、資源、判斷偏差）

## 4. 時機層（Mandatory）

- 使用 `timeRecommendations[]` 結構化時間建議：
  - `type`: favorable / unfavorable / critical
  - `startDate` / `endDate`: 時間區間
  - `confidence`: 信心值 (0–1)
  - `description`: 描述
- 結合時間建議輸出：
  - 何時可推進
  - 何時宜觀察
  - 何時需止損
- 檢查 `warnings[]` 取得吉凶警示
- 明確時間區間，避免泛泛而談

## 5. 結論層

- 給出傾向結論：`成 / 可成但延遲 / 暫難成`
- 每個結論必須綁定證據點（引用 `fullYaos` 爻位或 `yongShen` 強度資料）

## 6. Quick Template

1. 結論摘要（結果傾向 + 關鍵時間區間）
2. 核心依據（用神狀態 + 世應 + 動爻）
3. 風險點（空亡、沖克、伏神受制）
4. 行動建議（當下一週/一月具體作法）
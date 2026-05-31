# DaYun Workflow（固定順序）

## 0. Input Check

- **⏰ 先取得當前時間**（用於定位目前大運步）
- 必要輸入：`gender`, `birthYear`, `birthMonth`, `birthDay`, `birthHour`
- 可選輸入：
  - `birthMinute` — 精確到分鐘，預設 0
  - `calendarType` — `solar`（預設）/ `lunar`
  - `isLeapMonth` — 僅 `calendarType=lunar` 有效，預設 false
- 調用工具：`dayun_calculate`

## 1. 大運資料層

- 遍歷 `list[]`（最多 10 步大運），擷取每步：
  - `startYear` → 大運起始年份
  - `ganZhi` → 大運干支
  - `stem` → 天干
  - `branch` → 地支
  - `tenGod` → 天干十神（相對日主）
  - `branchTenGod` → 地支主氣十神
  - `hiddenStems[]` → 藏干明細（每項含 `stem`, `qiType`: 本氣/中氣/餘氣, `tenGod`）
  - `naYin` → 納音
  - `diShi` → 地勢（十二長生）
  - `shenSha[]` → 本步大運神煞

## 2. 大運節奏層（Mandatory）

- 標註天干十神與地支十神是否協調（有無截腳/蓋頭）
- 分析 `hiddenStems[]` 中的藏干十神：多重力量疊加或彼此牽制
- 參考 `naYin`（納音）判斷五行能量質感
- 參考 `diShi`（十二長生）判斷日主於該運中的生旺死絕狀態
- 關注 `shenSha[]` 中的吉凶神煞對該運的助力或阻礙

## 3. 當前大運定位（Mandatory）

- 根據使用者 `birthYear` 與**當前年份**（由當前時間取得）計算年齡
- 在 `list[]` 中找到 `startYear <= 當前年份` 的最近一步 = 當前大運
- 輸出當前大運的詳細解讀：
  - 十年主題定性（結合 `tenGod` + `branchTenGod` + `hiddenStems`）
  - 已過/剩餘年數
  - 神煞影響（由 `shenSha[]` 解讀）
  - 地勢狀態（由 `diShi` 解讀日主狀態）
  - 與原命盤喜用神的關係（幫身 或 克洩）

## 4. 關鍵轉折點

- 識別大運切換年份（相鄰兩步 `startYear`）
- 標註十神由 X 轉 Y 的轉折（如由「正財」轉「七殺」＝由穩定期進入挑戰期）
- 對比相鄰大運的 `shenSha[]` 變化
- 輸出未來最近的轉折時間與調整建議

## 5. 結論層

- 避免絕對化表述
- 每條判斷需綁定 `tenGod` / `branchTenGod` / `shenSha` / `diShi` 的資料依據

## 6. Quick Template

1. 當前大運（干支 + 十神 + 納音 + 地勢 + 神煞 + 主題）
2. 下一步大運預覽（轉折時間 + 新主題 + 神煞變化）
3. 十年節奏建議（守 / 攻 / 調整分段）
4. 行動建議（可執行）
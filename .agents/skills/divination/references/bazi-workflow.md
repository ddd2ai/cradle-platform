# Bazi Workflow（固定順序）

## 0. Input Check

- **⏰ 先取得當前時間**（用於大運流年定位）
- 必要輸入：`gender`, `birthYear`, `birthMonth`, `birthDay`, `birthHour`
- 可選輸入：
  - `birthMinute` — 精確到分鐘，預設 0
  - `calendarType` — `solar`（預設）/ `lunar`；使用者提供農曆日期時必須設為 `lunar`
  - `isLeapMonth` — 僅 `calendarType=lunar` 有效，工具會校驗該年該月是否確為閏月
  - `birthPlace` — 出生地點（可選，記錄用途）
- 若使用者只提供四柱：先用 `bazi_pillars_resolve` 反查候選時間，經使用者確認後再用 `bazi`（利用候選的 `nextCall` 參數，補充 `gender`）
- 缺少關鍵資訊時先補齊，不進入結論階段

## 1. 盤面基礎層

- 從 output 擷取：
  - `dayMaster` → 日主天干
  - `fourPillars.year/month/day/hour` → 四柱干支
  - 每柱 `hiddenStems[]` → 藏干（含 `qiType`: 本氣/中氣/餘氣 + `tenGod`: 相對日主十神）
  - 每柱 `shenSha[]` → 分柱神煞
  - 每柱 `kongWang.isKong` → 是否入空亡
  - `kongWang`（全域）→ 旬名 + 空亡地支
- 明確季節/月令背景（月柱地支 → 旺衰環境）

## 2. 身強/身弱判定層（Mandatory）

- 依據月令、通根、透干、幫扶/克洩耗綜合評估
- 參考 `fourPillars` 各柱 `diShi`（十二長生）輔助判斷
- 輸出：`身強` / `身弱` / `中和偏強` / `中和偏弱` / `從格` 等
- 給出 3 條以內關鍵證據

## 3. 喜用神判定層（Mandatory）

- 先定格局平衡目標，再定用神，最後給喜神/忌神
- 參考 `fourPillars` 各柱 `naYin`（納音）輔助五行分析
- 輸出結構：
  - 用神（主調節五行）
  - 喜神（輔助五行）
  - 忌神（加劇失衡）

## 4. 人生主題層

- 從十神組合提煉：事業、財務、關係、健康、學習/表達
- 參考 `relations[]` 中的地支刑害合沖關係
- 每個主題給出 `趨勢 + 原因 + 行動點`

## 5. 大運流年層（Mandatory）

- 調用 `dayun_calculate` 取得大運列表
  - 需要相同的 `gender` + `birth*` 參數
  - Output: `list[]`（每步大運包含 `startYear`, `ganZhi`, `stem`, `branch`, `tenGod`, `branchTenGod`, `hiddenStems[]`, `naYin`, `diShi`, `shenSha[]`）
- 根據當前年份定位目前大運步，參考 `diShi`（地勢）與 `shenSha[]`（神煞）輔助判斷
- 先看大運（10 年基調），再看流年（年度觸發），再看流月（短期波動）
- 輸出近 3 年節奏建議（守 / 攻 / 調整）

## 6. 結論表達層

- 結論避免「宿命絕對化」
- 使用機率與條件表達：
  - 推薦：`若 A 持續，則 B 機率上升`
  - 避免：`你一定會...`

## 7. Quick Template

1. 結論摘要（身強弱 + 喜用神 + 當前運勢）
2. 核心依據（3–6 個盤面證據）
3. 分項解讀（事業 / 財務 / 關係 / 健康）
4. 大運流年窗口（近 / 中 / 遠）
5. 行動建議（可執行）
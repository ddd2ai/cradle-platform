# Time Trend Workflow（固定順序）

## 0. Input Check

- **⏰ 先取得當前時間**（用於日運日期與大運定位）
- 區分時間粒度：Daily（日運）vs Period（大運/流年）
- 每日運勢 Inputs：`date`（預設今天），可選 `birthYear` + `dayMaster` 或完整八字
- 大運計算 Inputs：`gender`, `birthYear`, `birthMonth`, `birthDay`, `birthHour` + 可選 `calendarType`, `isLeapMonth`, `birthMinute`
- 建議：對於每日運勢，若使用者未提供八字，僅輸出通用黃曆資訊；若提供八字則輸出個人化十神並推導幸運色/方位。

## 1. 每日運勢（Daily Fortune）

### 1.1 Tool Call
- 呼叫 `daily_fortune`
- 必要參數：無
- 可選參數：`date`, `dayMaster`, `birthYear`, `birthMonth`, `birthDay`, `birthHour`

### 1.2 Analysis
- **黃曆背景（Almanac Context）**（從 `almanac` 擷取）：
    - `lunarDate` / `lunarMonth` / `lunarDay` → 農曆日期
    - `solarTerm` → 節氣（如有）
    - `suitable[]` / `avoid[]` → 宜/忌
    - `chongSha` → 沖煞
    - `jishen[]` → 吉神宜趨
    - `xiongsha[]` → 凶煞宜忌
    - `pengZuBaiJi[]` → 彭祖百忌
    - 辨識當日能量基調（如：破日、三合日、天赦日等）
- **日資訊（Day Info）**（從 `dayInfo` 擷取）：
    - `stem` / `branch` / `ganZhi` → 日干支
- **個人化分析（若提供 `dayMaster`）**：
    - 分析 `tenGod`（流日十神）：例如傷官日需防口舌，正財日利於求財
- **幸運色/方位推導**：
    - 採用「依據 → 結論」兩段式輸出：依據八字推導幸運顏色與幸運方位

## 2. 大運分析（DaYun Analysis）

### 2.1 Tool Call
- 呼叫 `dayun_calculate`
- 必要參數：`gender`, `birthYear`, `birthMonth`, `birthDay`, `birthHour`
- 可選參數：`birthMinute`, `calendarType`（solar/lunar）, `isLeapMonth`

### 2.2 Analysis
- **大運列表**（遍歷 `list[]`）：
    - `startYear` → 大運起始年份
    - `ganZhi` → 大運干支
    - `stem` / `branch` → 天干/地支
    - `tenGod` → 大運天干十神（相對日主）
    - `branchTenGod` → 大運地支主氣十神
    - `hiddenStems[]` → 藏干明細（含 qiType/tenGod）
    - `naYin` → 納音
    - `diShi` → 地勢（十二長生）
    - `shenSha[]` → 神煞
- **大運背景（10 年宏觀）**：
    - 根據使用者年齡定位目前大運
    - 判斷大運是幫身或克洩，確立十年基調
- **流年分析（1 年觸發）**：
    - 結合當前年份干支與日主關係
    - 檢查干支之間的合/沖/刑/害關係
    - 輸出 `trend`：有利 / 中性 / 不利
- **流月分析（短期波動）**：
    - 僅在使用者要求時提供
    - 標示關鍵機會或風險月份

## 3. 綜合層（Synthesis Layer）（Mandatory）

- 當使用者詢問「今年運勢」時：
    1. 先看大運（底色）— 來自 `dayun_calculate`
    2. 再看流年干支（主事件）
    3. 結合大運 `tenGod` 解釋吉凶原因
- 當使用者詢問「明天運勢」時：
    1. 先看流月（月份環境）
    2. 再看流日（日觸發）— 來自 `daily_fortune`
    3. 輸出具體宜忌

## 4. Quick Template

1. **結論摘要**：（例如：「中平偏吉，利事業，忌高風險投資」）
2. **時間能量**：
    - 黃曆/節氣背景（來自 `almanac`）
    - 個人化十神（例如：「今日偏財主事」，來自 `tenGod`）
3. **關鍵指標**：
    - 大運趨勢（來自 `dayun_calculate` → `tenGod/branchTenGod`）
    - 日運趨勢（來自 `daily_fortune`）
4. **行動指南**：
    - 宜：...
    - 忌：...
    - 幸運錦囊（推導出的顏色/方位）
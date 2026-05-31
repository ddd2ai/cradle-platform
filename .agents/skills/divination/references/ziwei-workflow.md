# Ziwei Workflow（固定順序）

## 0. Input Check

- **⏰ 先取得當前時間**（用於大限定位）
- 必要輸入：`gender`, `birthYear`, `birthMonth`, `birthDay`, `birthHour`
- 可選輸入：
  - `birthMinute` — 精確到分鐘，預設 0
  - `calendarType` — `solar`（預設）/ `lunar`；使用者提供農曆日期時必須設為 `lunar`
  - `isLeapMonth` — 僅 `calendarType=lunar` 有效，預設 false
- 輸出需包含：命宮、身宮、十二宮主星、大限資訊

## 1. 命盤骨架層

- 從 output 擷取：
  - `soul` → 命主
  - `body` → 身主
  - `fiveElement` → 五行局（決定起運歲數與紫微星佈局）
  - `fourPillars` → 四柱干支
  - `solarDate` / `lunarDate` → 日期確認
  - `zodiac` / `sign` → 生肖/星座
- 先看命宮/身宮定位（人格驅動力 + 行為模式）
- 再看主星組合與四化分布（於 `palaces[].majorStars[].mutagen` 中查找祿/權/科/忌）

## 2. 宮位主題層（Mandatory）

- 遍歷 `palaces[]`，重點關注：
  - 每宮 `name` → 宮名
  - `majorStars[]` → 主星（含 `brightness`: 廟/旺/得/利/平/不/陷 + `mutagen`: 四化）
  - `minorStars[]` → 輔星（含亮度與四化）
  - `adjStars[]` → 雜曜
  - `isBodyPalace` → 是否為身宮
- 必查宮位：
  - 命宮（底層性格與穩定傾向）
  - 官祿宮（事業模式）
  - 財帛宮（財富機制）
  - 夫妻宮（關係機制）
  - 疾厄宮（身心壓力點）

## 3. 大限層（Mandatory）

- 使用 `decadalList[]` 資料定位當前大限：
  - `startAge` / `endAge` → 年齡區間
  - `heavenlyStem` → 大限天干
  - `palace.name` → 大限所在宮名
  - `palace.earthlyBranch` → 大限地支
- 根據使用者年齡計算目前處於哪一步大限
- 先看當前大限宮位與主導星曜
- 判斷該十年主題：擴張 / 沉澱 / 轉型 / 防守
- 再映射到事業、關係、財務優先順序

## 4. 衝突與補償層

- 找出優勢結構（可放大）
- 找出結構性短板（需補強）
- 提供「可執行補償策略」，避免空泛標籤

## 5. 結論層

- 輸出風格：結構化，而非玄學散文
- 每條建議需對應至少一個宮位或星曜依據

## 6. Quick Template

1. 命盤主軸（命宮/身宮 + 主星 + 四化）
2. 當前十年主題（大限 + 宮位）
3. 三大優先事項（事業 / 關係 / 財務）
4. 風險與補償行動（具體執行）
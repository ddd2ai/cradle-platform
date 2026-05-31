# MCP 工具矩陣

## 核心工具

| 工具                   | 用途               | 必要輸入                                                   | 可選輸入                                                                                              | 主要輸出欄位                                                                                       | 核心來源                                                                  |
|------------------------|--------------------|------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------|
| `bazi`                 | 八字命盤計算       | `gender`, `birthYear`, `birthMonth`, `birthDay`, `birthHour` | `birthMinute`, `calendarType`, `isLeapMonth`, `birthPlace`, `longitude`                               | `dayMaster`, `fourPillars`, `relations`, `kongWang`, `taiYuan`, `mingGong`                         | `packages/core/src/domains/bazi/manifest.ts` -> `packages/core/src/bazi-core.ts` |
| `bazi_pillars_resolve` | 四柱反查公/農曆候選 | `yearPillar`, `monthPillar`, `dayPillar`, `hourPillar`       | —                                                                                                      | `count`, `candidates[]`, `nextCall`                                                                 | `packages/core/src/domains/bazi-pillars-resolve/manifest.ts` -> `packages/core/src/bazi-pillars-resolve-core.ts` |
| `bazi_dayun`           | 大運、小運、流年鏈路 | `gender`, `birthYear`, `birthMonth`, `birthDay`, `birthHour` | `birthMinute`, `calendarType`, `isLeapMonth`                                                          | `startAge`, `xiaoYun`, `list[]`, `liunianList[]`                                                   | `packages/core/src/domains/bazi-dayun/manifest.ts` -> `packages/core/src/dayun-core.ts` |
| `ziwei`                | 紫微斗數排盤       | `gender`, `birthYear`, `birthMonth`, `birthDay`, `birthHour` | `birthMinute`, `calendarType`, `isLeapMonth`, `longitude`                                             | `palaces[]`, `decadalList[]`, `soul`, `body`, `fiveElement`                                        | `packages/core/src/domains/ziwei/manifest.ts` -> `packages/core/src/ziwei-core.ts` |
| `ziwei_horoscope`      | 紫微運限           | `gender`, `birthYear`, `birthMonth`, `birthDay`, `birthHour` | `birthMinute`, `calendarType`, `isLeapMonth`, `longitude`, `targetDate`, `targetTimeIndex`           | `decadal`, `age`, `yearly`, `monthly`, `daily`, `hourly`, `transitStars`                           | `packages/core/src/domains/ziwei-horoscope/manifest.ts` -> `packages/core/src/ziwei-horoscope-core.ts` |
| `ziwei_flying_star`    | 紫微飛星/四化分析  | `gender`, `birthYear`, `birthMonth`, `birthDay`, `birthHour`, `queries` | `birthMinute`, `calendarType`, `isLeapMonth`, `longitude`                                             | `results[]`                                                                                         | `packages/core/src/domains/ziwei-flying-star/manifest.ts` -> `packages/core/src/ziwei-flying-star-core.ts` |
| `liuyao`               | 六爻排卦與分析     | `question`, `yongShenTargets`, `date`                        | `method`, `numbers`, `hexagramName`, `changedHexagramName`, `detailLevel`                            | `fullYaos[]`, `yongShen[]`, `shenSystemByYongShen[]`, `fuShen[]`, `timeRecommendations[]`, `warnings[]` | `packages/core/src/domains/liuyao/manifest.ts` -> `packages/core/src/liuyao-core.ts` |
| `meihua`               | 梅花易數起卦與斷卦 | `question`, `date`, `method`                                 | `count`, `countCategory`, `text`, `textSplitMode`, `measureKind`, `upperCue`, `lowerCue`, `numbers`  | `hexagram`, `mutualHexagram`, `changedHexagram`, `bodyTrigram`, `useTrigram`, `judgement`          | `packages/core/src/domains/meihua/manifest.ts` -> `packages/core/src/meihua-core.ts` |
| `tarot`                | 塔羅抽牌           | —                                                            | `spreadType`, `question`, `allowReversed`, `seed`, `birthYear`, `birthMonth`, `birthDay`             | `cards[]`, `spreadName`, `seed`, `numerology`                                                      | `packages/core/src/domains/tarot/manifest.ts` -> `packages/core/src/tarot-core.ts` |
| `almanac`              | 黃曆/每日運勢      | —                                                            | `dayMaster`, `birthYear`, `birthMonth`, `birthDay`, `birthHour`, `date`                              | `dayInfo`, `tenGod`, `almanac`                                                                     | `packages/core/src/domains/fortune/manifest.ts` -> `packages/core/src/fortune-core.ts` |
| `qimen`                | 奇門遁甲排盤       | `year`, `month`, `day`, `hour`                               | `minute`, `timezone`, `question`, `panType`, `juMethod`, `zhiFuJiGong`, `detailLevel`                | `dateInfo`, `siZhu`, `palaces[]`, `kongWang`, `yiMa`, `globalFormations`                           | `packages/core/src/domains/qimen/manifest.ts` -> `packages/core/src/qimen-core.ts` |
| `daliuren`             | 大六壬排盤         | `date`, `hour`                                               | `minute`, `timezone`, `question`, `birthYear`, `gender`, `detailLevel`                               | `dateInfo`, `tianDiPan`, `siKe`, `sanChuan`, `keTi`, `shenSha`, `gongInfos`                        | `packages/core/src/domains/daliuren/manifest.ts` -> `packages/core/src/daliuren-core.ts` |

## 實務注意事項

- **輸入驗證**：呼叫工具前務必驗證 `gender`（male/female）與日期範圍。
- **曆法類型**：預設為 `solar`（陽曆）。使用者提供農曆時必須設定 `calendarType: 'lunar'`，若為閏月需同時設定 `isLeapMonth: true`。
- **模糊處理**：當使用者僅提供四柱且無曆法日期時，優先使用 `bazi_pillars_resolve`，再透過 `nextCall` 串接 `bazi`。
- **可重現性**：在六爻/塔羅/運勢中可使用 `seed` 以確保結果可重現（適用於除錯或一致對話）。
- **錯誤處理**：工具拋出錯誤時需判斷：
  - 輸入錯誤 → 提示使用者修正
  - 內部錯誤 → 告知「計算暫不可用」
- **工具串接**：
  - `bazi_pillars_resolve` → `bazi` 為標準流程
  - `bazi` + `bazi_dayun` 覆蓋完整八字與大運分析
- **Schema來源**：所有工具定義位於 `packages/core/src/tools.ts`。當 schema 變更時，需同步更新本矩陣與 workflows。
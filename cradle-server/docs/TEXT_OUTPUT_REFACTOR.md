# Text Output Refactor

## 問題描述

JavaScript template literal 的經典問題:**程式碼縮排會變成字串內容**。

### 問題範例

```js
// ❌ 錯誤:縮排會成為輸出的一部分
await fs.writeFile(
  "file.md",
  `# Title

  Content line 1
  Content line 2
  `,
  "utf8"
);

// 實際輸出:
// # Title
//
//   Content line 1    <-- 多了縮排!
//   Content line 2    <-- 多了縮排!
//
```

這會導致:
- Memory 文件內容縮排錯誤
- Knowledge/History/Thought 文字格式不正確
- Console 輸出視覺混亂
- Prompt 內容格式問題

## 解決方案

建立統一的文字輸出工具:`src/utils/text.js`

### 工具函式

```js
// 將字串陣列組合成多行文字
export function block(lines) {
  return lines.join("\n");
}

// 將陣列項目映射成字串陣列
export function list(items, mapper = (item) => item) {
  return items.map(mapper);
}
```

### 使用方式

```js
import { block } from "../utils/text.js";

// ✅ 正確:使用陣列明確控制每一行
await fs.writeFile(
  "file.md",
  block([
    "# Title",
    "",
    "Content line 1",
    "Content line 2",
    "",
  ]),
  "utf8"
);

// 實際輸出:
// # Title
//
// Content line 1    <-- 完美對齊!
// Content line 2    <-- 完美對齊!
//
```

### 動態內容

```js
// 使用 spread operator 插入動態內容
await child.appendKnowledge(
  block([
    "## Parents",
    "",
    ...parentIds.map((id) => `- ${id}`),
    "",
    "## Weights",
    "",
    ...plan.weights.map((item) => `- ${item.cellId}: ${item.weight}`),
    "",
  ])
);
```

### Console 輸出

```js
console.log(
  block([
    "",
    "🧬 Cell Fusion Complete",
    "",
    "Parents:",
    parentIds.join(", "),
    "",
    "Child:",
    childId,
    "",
  ])
);
```

## 修改範圍

### 已修復的檔案

1. **src/utils/text.js** (新建)
   - `block()` 函式
   - `list()` 函式

2. **src/commands/colony-commands.js**
   - ✅ `fs.writeFile()` - identity 檔案
   - ✅ `fs.writeFile()` - parent memory 檔案
   - ✅ `appendKnowledge()` - fusion origin
   - ✅ `appendHistory()` - fusion summary
   - ✅ `appendThought()` - child & parent thoughts
   - ✅ `console.log()` - fusion complete 訊息

3. **src/cradle-cell.js**
   - ✅ `appendHistory()` - task completion (行 308)
   - ✅ `appendThought()` - task experience (行 319)
   - ✅ `appendHistory()` - user interaction (行 467)
   - ✅ `writeMemory()` - history (行 1269)
   - ✅ `appendThought()` - birth from division (行 1269)
   - ✅ `appendKnowledge()` - SVD division origin (行 1356)
   - ✅ `appendThought()` - child & parent division thoughts (行 1386, 1397)
   - ✅ `appendThought()` - reflection (行 1955)
   - ✅ `appendKnowledge()` - learned reflection (行 1960)
   - ✅ `appendThought()` - consciousness thought (行 2058)
   - ✅ `appendThought()` - inbox summary (行 2119)
   - ✅ `appendKnowledge()` - inbox processed (行 2124)

4. **src/commands/cell-commands.js**
   - ✅ `appendKnowledge()` - feed command (行 320)
   - ✅ `appendKnowledge()` - specialization (行 1173)

### 驗證結果

```bash
# 所有 writeFile 的 template literal 已修復
grep -Rn "writeFile.*\`" src
# 結果: 0 個匹配

# 所有 append 方法的 template literal 已修復
grep -Rn "append.*(\`" src
# 結果: 0 個匹配

# 所有 writeMemory 方法的 template literal 已修復
grep -Rn "writeMemory.*\`" src
# 結果: 0 個匹配
```

## 影響與好處

### 1. 記憶體檔案品質提升
- Identity/Knowledge/History/Thought 文件格式正確
- 無多餘縮排
- 易於閱讀與維護

### 2. Console 輸出清晰
- 結構化訊息對齊一致
- 視覺層次清楚

### 3. 程式碼可維護性
- 明確的行結構
- 易於新增/刪除行
- 動態內容插入簡單

### 4. 未來擴展
- 統一的文字處理規範
- 可以輕鬆添加新的文字工具函式
- 減少重複程式碼

## 最佳實踐

### 何時使用 `block()`

✅ **應該使用:**
- 多行文字輸出 (3行以上)
- 需要保持格式的文件內容
- 需要動態插入內容的情況
- Console 結構化輸出

❌ **不需要使用:**
- 單行文字
- 簡單的 template literal 插值
- 已經是字串的變數

### 程式碼風格

```js
// ✅ 好:清楚的結構
block([
  "## Section",
  "",
  "Content",
  "",
])

// ❌ 避免:混合風格
`## Section

${block(["Content"])}
`
```

## 相關議題

這個重構解決了 Cradle 的「文字輸出規範」問題,確保所有記憶體、知識庫、提示詞的文字內容都保持乾淨、一致的格式。

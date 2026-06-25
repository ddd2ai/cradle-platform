/**
 * 將字串陣列組合成多行文字,避免 template literal 的縮排問題
 * @param {string[]} lines - 字串陣列
 * @returns {string} 組合後的多行文字
 */
export function block(lines) {
  return lines.join("\n");
}

/**
 * 將陣列項目映射成字串陣列
 * @param {Array} items - 來源陣列
 * @param {Function} mapper - 映射函式,預設為 identity function
 * @returns {string[]} 映射後的字串陣列
 */
export function list(items, mapper = (item) => item) {
  return items.map(mapper);
}

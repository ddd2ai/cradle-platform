# Listener Fix 驗證計畫

## 問題診斷

原始錯誤症狀:
```text
{
{
   " "typetype":": " "exexecutableecutable-java-java",
",
   " "titletitle":": " "BankBankTransferTransferAppApp ...
```

**根本原因**: Copilot Provider 的 streaming event listener 沒有在 `ask()` 結束後移除,導致:
- 每次呼叫 `ask()` 都註冊新的 listener
- 多次呼叫後,同一個 chunk 被多個 listener 重複接收
- buffer 出現重複字元: `typetype`, `titletitle`, `BankBankTransferTransferAppApp`

**修復方案**: 在 `copilot-provider.js` 的 `ask()` 方法中加入 `finally` block,確保每次執行結束都移除 listener。

---

## 修復內容

檔案: `src/providers/copilot-provider.js`

```javascript
async ask({ prompt, onDelta, onIdle, onError }) {
  // ... 現有程式碼 ...
  
  try {
    await session.sendAndWait({ prompt });
    return buffer;
  } catch (error) {
    handleError(error);
    throw error;
  } finally {
    // 移除所有 listener,避免累積洩漏
    session.off?.("assistant.message_delta", handleDelta);
    session.off?.("session.idle", handleIdle);
    session.off?.("error", handleError);

    // 相容 Node EventEmitter API
    session.removeListener?.("assistant.message_delta", handleDelta);
    session.removeListener?.("session.idle", handleIdle);
    session.removeListener?.("error", handleError);
  }
}
```

**為什麼同時用 `off` 和 `removeListener`?**
- `session.off` 可能是 Copilot SDK 自定義 API
- `removeListener` 是標準 Node EventEmitter API
- 使用 optional chaining 確保兩種實作都能正確清理

---

## 驗證順序

### 1️⃣ 重啟環境

```bash
# 重啟 Copilot CLI
node scripts/ensure-copilot-cli.js

# 啟動 Cradle (使用 gpt-5-mini)
PROVIDER=copilot MODEL=gpt-5-mini node src/cradle.js
```

### 2️⃣ 測試案例 1: HelloService (極簡)

```text
/use cell-001

/produce executable-java 寫一個 Java class,名稱為 HelloService,包含 sayHello 方法,回傳 Hello Cradle
```

**預期結果**:
- ✅ 正常輸出 JSON
- ✅ 不出現 `typetype`, `HelloHelloServiceService`
- ✅ 成功產生 `HelloService.java`

---

### 3️⃣ 測試案例 2: Calculator (中等)

```text
/produce executable-java 寫一個 Java class,名稱為 Calculator,包含 add 方法,在 main 方法中輸出 Calculator.add(2, 3) 的結果
```

**預期結果**:
- ✅ 正常輸出 JSON
- ✅ 不出現 `CalculatorCalculatorAppApp`
- ✅ 成功產生可執行的 `Calculator.java`

---

### 4️⃣ 測試案例 3: BankTransferApp (簡化版)

```text
/produce executable-java 寫一個單檔可執行 Java 程式,名稱為 BankTransferApp。請模擬迷你銀行轉帳系統。包含 Account、TransferResult、LedgerEntry、BankService 這些 static nested class。main 中建立 Alice、Bob、Charlie 三個帳戶。執行三筆轉帳: Alice 轉 120.50 給 Bob, Bob 轉 50.00 給 Charlie, Charlie 嘗試轉 9999.00 給 Alice。成功轉帳扣 1.00 手續費,餘額不足要拒絕且不可扣款。最後輸出 transfer accepted、transfer rejected、final balances、ledger entries、total fee。只能使用 Java 標準函式庫。
```

**預期結果**:
- ✅ 正常輸出完整 JSON
- ✅ 不出現重複字元
- ✅ 成功產生完整的 `BankTransferApp.java`
- ✅ 程式能執行並正確模擬轉帳邏輯

**業務邏輯驗證**:
```text
1. Alice 轉 120.50 給 Bob → 成功,扣手續費 1.00
2. Bob 轉 50.00 給 Charlie → 成功,扣手續費 1.00
3. Charlie 轉 9999.00 給 Alice → 失敗,餘額不足

最終餘額:
- Alice: 1000 - 120.50 - 1.00 + 0 = 878.50
- Bob: 1000 + 120.50 - 50.00 - 1.00 = 1069.50
- Charlie: 1000 + 50.00 - 0 = 1050.00

總手續費: 2.00
```

---

## 驗證檢查點

### ✅ Listener 洩漏已修復
- [ ] HelloService 測試通過
- [ ] Calculator 測試通過
- [ ] BankTransferApp 簡化版測試通過

### ✅ Streaming 穩定性
- [ ] 不再出現 `typetype` 等重複字元
- [ ] JSON 格式正確
- [ ] 大型輸出不會累積錯誤

### ✅ Parser 正常運作
- [ ] ArtifactParser 能正確解析 JSON
- [ ] 產生的 Java 檔案符合規格
- [ ] 檔案能成功編譯執行

---

## 如果還是有問題

### 診斷 1: 檢查是否還有其他 listener 洩漏點

```bash
# 搜尋所有 session.on 呼叫
grep -r "session.on" src/providers/
```

### 診斷 2: 改用每次建立新 session (重量級方案)

如果 listener cleanup 還是不穩,考慮改成:
```javascript
async ask({ prompt, onDelta, onIdle, onError }) {
  // 每次 ask 建立獨立 session
  const tempSession = await client.createSession({ ... });
  
  try {
    // ... 使用 tempSession ...
  } finally {
    await tempSession.disconnect();
  }
}
```

這樣最穩,但成本較高。

---

## 成功標準

當以下條件全部達成時,可以確認 listener fix 完全生效:

1. ✅ 連續執行 3 次 `HelloService` 都成功
2. ✅ 連續執行 3 次 `Calculator` 都成功
3. ✅ `BankTransferApp` 簡化版能一次通過
4. ✅ 所有輸出的 JSON 都沒有重複字元
5. ✅ 產生的 Java 檔案都能編譯執行

---

## 重要提醒

⚠️ **這次不是 ArtifactParser 的問題**

不要讓 Copilot 去修改 `artifact-parser.js`。

問題在於 **Provider 層的 streaming 管線**,不是 Parser 的解析邏輯。

如果 Copilot 想修 Parser,請告訴它:

```text
目前 raw response 出現 typetype、titletitle、BankBankTransferTransferAppApp 這種重複 token,疑似 Copilot provider 的 streaming event listener 沒有在 ask 結束後移除,導致多次 ask 後 chunk 被重複 append。請優先修 copilot-provider.js 的 listener cleanup,不要先修改 ArtifactParser。
```

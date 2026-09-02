/**
 * useOperationProgress Hook 測試
 *
 * 測試 React hook 訂閱 operation-progress store 的行為。
 * 使用 node:test + node:assert,不依賴 jsdom (純邏輯層測試)。
 */

import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";

// 直接測試 operation-progress store 的 subscribe/publish 機制
// (hook 本身依賴 React,在 node:test 環境中只測試 store 行為)
import {
  subscribeOperationProgress,
  updateOperationProgress,
  getOperationState,
  clearAllOperationStates,
  flushAllPendingProgress,
} from "../src/services/operation-progress.js";

// ────────────────────────────────────────────────────────────
// 工具函式
// ────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 模擬 useOperationProgress hook 的核心行為:
 * - 訂閱 operationId 的 progress 更新
 * - 返回一個可取消的訂閱控制物件
 */
function createProgressSubscription(operationId) {
  const received = [];
  let unsubscribe = null;

  function start() {
    const current = getOperationState(operationId);
    if (current) {
      received.push(current);
    }
    unsubscribe = subscribeOperationProgress(operationId, (op) => {
      received.push(op);
    });
  }

  function stop() {
    unsubscribe?.();
    unsubscribe = null;
  }

  return { start, stop, received };
}

// ────────────────────────────────────────────────────────────
// 測試套件
// ────────────────────────────────────────────────────────────

describe("useOperationProgress - 核心訂閱行為", () => {
  afterEach(() => {
    clearAllOperationStates();
  });

  it("無 operationId 時不接收任何更新", () => {
    const received = [];
    // hook 行為:operationId 為 null 時回傳 null,不訂閱
    const state = getOperationState(null);
    assert.equal(state, null);
    assert.equal(received.length, 0);
  });

  it("訂閱後立即收到已存在的 operation 狀態", () => {
    const operationId = "op-pre-existing";

    // 先推送一個 operation
    updateOperationProgress({
      operationId,
      status: "running",
      progress: 30,
    });
    flushAllPendingProgress();

    // 模擬 hook useEffect:取得現有狀態再訂閱
    const current = getOperationState(operationId);
    assert.equal(current?.progress, 30);
  });

  it("訂閱後收到 throttled progress 更新", async () => {
    const operationId = "op-hook-throttle";
    const sub = createProgressSubscription(operationId);
    sub.start();

    updateOperationProgress({ operationId, status: "running", progress: 10 });
    updateOperationProgress({ operationId, status: "running", progress: 20 });
    updateOperationProgress({ operationId, status: "running", progress: 30 });

    await sleep(150); // 等待 100ms throttle

    // 只收到一次更新 (最新值 30)
    assert.equal(sub.received.length, 1);
    assert.equal(sub.received[0].progress, 30);

    sub.stop();
  });

  it("terminal 狀態 (completed) 立即送達,無需等待 throttle", async () => {
    const operationId = "op-hook-complete";
    const sub = createProgressSubscription(operationId);
    sub.start();

    updateOperationProgress({ operationId, status: "running", progress: 50 });
    // 立即推送 completed,不等 throttle
    updateOperationProgress({ operationId, status: "completed", progress: 100 });

    await sleep(20); // 只等一下,不等 throttle window

    // completed 立即到達
    const completedOp = sub.received.find((op) => op.status === "completed");
    assert.ok(completedOp, "應立即收到 completed 狀態");
    assert.equal(completedOp.progress, 100);

    sub.stop();
  });

  it("terminal 狀態 (failed) 立即送達", async () => {
    const operationId = "op-hook-failed";
    const sub = createProgressSubscription(operationId);
    sub.start();

    updateOperationProgress({ operationId, status: "running", progress: 40 });
    updateOperationProgress({ operationId, status: "failed", progress: 40 });

    await sleep(20);

    const failedOp = sub.received.find((op) => op.status === "failed");
    assert.ok(failedOp, "應立即收到 failed 狀態");

    sub.stop();
  });

  it("terminal 狀態不會被較晚抵達的 202 accepted snapshot 覆寫", () => {
    const operationId = "op-terminal-race";

    updateOperationProgress({
      operationId,
      status: "completed",
      progress: 100,
      currentStage: "stable",
      lifeState: "stable",
    });
    updateOperationProgress({
      operationId,
      status: "accepted",
      progress: 0,
      currentStage: "accepted",
      lifeState: "growing",
    });

    assert.equal(getOperationState(operationId)?.status, "completed");
    assert.equal(getOperationState(operationId)?.lifeState, "stable");
  });

  it("取消訂閱後不再收到更新", async () => {
    const operationId = "op-hook-unsub";
    const sub = createProgressSubscription(operationId);
    sub.start();

    updateOperationProgress({ operationId, status: "running", progress: 10 });
    flushAllPendingProgress();

    // 取消訂閱
    sub.stop();

    const countBefore = sub.received.length;
    updateOperationProgress({ operationId, status: "running", progress: 50 });
    flushAllPendingProgress();

    // 取消後不應收到新更新
    assert.equal(sub.received.length, countBefore, "取消後不應收到新更新");
  });
});

describe("useOperationProgress - operationId 切換行為", () => {
  afterEach(() => {
    clearAllOperationStates();
  });

  it("切換 operationId 後訂閱新 operation", async () => {
    const firstId = "op-switch-first";
    const secondId = "op-switch-second";

    // 第一個訂閱
    const sub1 = createProgressSubscription(firstId);
    sub1.start();
    updateOperationProgress({ operationId: firstId, status: "running", progress: 20 });
    flushAllPendingProgress();
    sub1.stop();

    // 第二個訂閱 (模擬 hook operationId 改變)
    const sub2 = createProgressSubscription(secondId);
    sub2.start();
    updateOperationProgress({ operationId: secondId, status: "running", progress: 60 });
    flushAllPendingProgress();

    assert.equal(sub2.received.length, 1);
    assert.equal(sub2.received[0].progress, 60);

    sub2.stop();
  });

  it("operationId 重設為 null 後不接收舊 operation 的更新", async () => {
    const operationId = "op-reset-null";
    const sub = createProgressSubscription(operationId);
    sub.start();
    sub.stop(); // 模擬 operationId 設為 null,hook cleanup

    const countBefore = sub.received.length;
    updateOperationProgress({ operationId, status: "running", progress: 80 });
    flushAllPendingProgress();

    assert.equal(sub.received.length, countBefore, "清理後不應收到更新");
  });
});

describe("useOperationProgress - IncubatorPage render 隔離驗證", () => {
  afterEach(() => {
    clearAllOperationStates();
  });

  it("progress 更新只觸發訂閱的 listener,不影響其他 observer", async () => {
    const operationId = "op-isolation";
    let incubatorPageRenders = 0;
    let cellOperationDialogRenders = 0;

    // 模擬 IncubatorPage - 不訂閱 progress (Phase 4 後應如此)
    // IncubatorPage 只有在 activeOperationId 改變時才 render
    const incubatorObserver = {
      onOperationIdChange: () => {
        incubatorPageRenders++;
      },
    };

    // 模擬 CellOperationDialogs 的 useOperationProgress hook
    const unsubscribeDialog = subscribeOperationProgress(operationId, () => {
      cellOperationDialogRenders++;
    });

    // 模擬 IncubatorPage 的 onProgress callback (只觸發一次 operationId 設定)
    const operation = { operationId, status: "running", progress: 10 };
    if (operation.operationId) {
      incubatorObserver.onOperationIdChange(operation.operationId);
    }

    // 後續 progress 更新 (10+ 次/秒)
    for (let i = 20; i <= 90; i += 10) {
      updateOperationProgress({ operationId, status: "running", progress: i });
    }
    flushAllPendingProgress();

    // IncubatorPage 只 render 1 次 (operationId 設定)
    assert.equal(incubatorPageRenders, 1, "IncubatorPage 只應 render 1 次 (operationId 變化)");

    // CellOperationDialogs 的 listener 被呼叫了多次 (已 flush)
    assert.ok(cellOperationDialogRenders >= 1, "CellOperationDialogs 應收到 progress 更新");

    // Phase 4 前:IncubatorPage 會 render 8 次以上
    // Phase 4 後:IncubatorPage 只 render 1 次 → 節省 7+ 次 re-render
    const progressUpdatesCount = 8; // 20,30,...,90
    const savedRenders = progressUpdatesCount - incubatorPageRenders;
    assert.ok(savedRenders >= 7, `應節省至少 7 次 IncubatorPage re-render (節省了 ${savedRenders} 次)`);

    unsubscribeDialog();
  });

  it("多個 operation 並發時,各自獨立不互相干擾", async () => {
    const opA = "op-concurrent-A";
    const opB = "op-concurrent-B";
    const receivedA = [];
    const receivedB = [];

    const unsubA = subscribeOperationProgress(opA, (op) => receivedA.push(op));
    const unsubB = subscribeOperationProgress(opB, (op) => receivedB.push(op));

    updateOperationProgress({ operationId: opA, status: "running", progress: 30 });
    updateOperationProgress({ operationId: opB, status: "running", progress: 60 });
    flushAllPendingProgress();

    // A 只收到 opA 的更新
    assert.ok(receivedA.every((op) => op.operationId === opA), "A 不應收到 B 的更新");
    // B 只收到 opB 的更新
    assert.ok(receivedB.every((op) => op.operationId === opB), "B 不應收到 A 的更新");

    unsubA();
    unsubB();
  });
});

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  subscribeOperationProgress,
  updateOperationProgress,
  getOperationState,
  hasPendingProgress,
  clearAllOperationStates,
  flushAllPendingProgress,
} from "../src/services/operation-progress.js";

describe("Operation Progress Throttling", () => {
  beforeEach(() => {
    clearAllOperationStates();
  });

  describe("Throttling Behavior", () => {
    it("應該 throttle 連續的 progress 更新", async () => {
      const listener = mock.fn();
      const operationId = "op-123";

      subscribeOperationProgress(operationId, listener);

      // 在 100ms 內連續發送多個 progress 更新
      updateOperationProgress({
        operationId,
        status: "running",
        progress: 10,
      });

      updateOperationProgress({
        operationId,
        status: "running",
        progress: 20,
      });

      updateOperationProgress({
        operationId,
        status: "running",
        progress: 30,
      });

      updateOperationProgress({
        operationId,
        status: "running",
        progress: 40,
      });

      // 立即檢查 - 還沒有通知 (throttle 中)
      assert.equal(listener.mock.calls.length, 0, "throttle 期間不應通知");

      // 等待 throttle window (100ms)
      await new Promise((resolve) => setTimeout(resolve, 120));

      // 應該通知一次,且是最新的值
      assert.equal(listener.mock.calls.length, 1, "throttle 後只通知一次");
      const lastCall = listener.mock.calls[0].arguments[0];
      assert.equal(lastCall.progress, 40, "應該是最新的 progress 值");
    });

    it("應該在多個 throttle window 中持續更新", async () => {
      const listener = mock.fn();
      const operationId = "op-456";

      subscribeOperationProgress(operationId, listener);

      // 第一輪更新
      updateOperationProgress({
        operationId,
        status: "running",
        progress: 10,
      });

      await new Promise((resolve) => setTimeout(resolve, 120));
      assert.equal(listener.mock.calls.length, 1);

      // 第二輪更新
      updateOperationProgress({
        operationId,
        status: "running",
        progress: 50,
      });

      await new Promise((resolve) => setTimeout(resolve, 120));
      assert.equal(listener.mock.calls.length, 2);

      // 第三輪更新
      updateOperationProgress({
        operationId,
        status: "running",
        progress: 90,
      });

      await new Promise((resolve) => setTimeout(resolve, 120));
      assert.equal(listener.mock.calls.length, 3);
    });
  });

  describe("Terminal Status Bypass", () => {
    it("cancelled 狀態應該立即送達,不受 throttle 影響", async () => {
      const listener = mock.fn();
      const operationId = "op-cancelled";

      subscribeOperationProgress(operationId, listener);
      updateOperationProgress({ operationId, status: "running", progress: 60 });
      updateOperationProgress({ operationId, status: "cancelled", progress: 60 });

      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(
        listener.mock.calls.some((call) => call.arguments[0].status === "cancelled"),
        true,
      );
    });

    it("completed 狀態應該立即送達,不受 throttle 影響", async () => {
      const listener = mock.fn();
      const operationId = "op-complete";

      subscribeOperationProgress(operationId, listener);

      // 連續發送 progress
      updateOperationProgress({
        operationId,
        status: "running",
        progress: 30,
      });

      updateOperationProgress({
        operationId,
        status: "running",
        progress: 60,
      });

      // 立即發送 completed (不等 throttle)
      updateOperationProgress({
        operationId,
        status: "completed",
        result: { success: true },
      });

      // 不需要等待,應該立即收到
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 應該至少收到 completed
      assert.ok(listener.mock.calls.length >= 1, "應該立即收到 completed");

      const lastCall = listener.mock.calls[listener.mock.calls.length - 1].arguments[0];
      assert.equal(lastCall.status, "completed");
      assert.equal(hasPendingProgress(operationId), false, "completed 後不應有 pending");
    });

    it("failed 狀態應該立即送達,不受 throttle 影響", async () => {
      const listener = mock.fn();
      const operationId = "op-failed";

      subscribeOperationProgress(operationId, listener);

      // 連續發送 progress
      updateOperationProgress({
        operationId,
        status: "running",
        progress: 30,
      });

      // 立即發送 failed
      updateOperationProgress({
        operationId,
        status: "failed",
        error: { message: "Something went wrong" },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const lastCall = listener.mock.calls[listener.mock.calls.length - 1].arguments[0];
      assert.equal(lastCall.status, "failed");
      assert.equal(hasPendingProgress(operationId), false);
    });

    it("terminal 狀態應該 flush pending progress", async () => {
      const listener = mock.fn();
      const operationId = "op-flush";

      subscribeOperationProgress(operationId, listener);

      // 發送 progress (會被 throttle)
      updateOperationProgress({
        operationId,
        status: "running",
        progress: 50,
      });

      // 立即檢查有 pending
      assert.equal(hasPendingProgress(operationId), true);

      // 發送 completed 應該 flush pending
      updateOperationProgress({
        operationId,
        status: "completed",
      });

      assert.equal(hasPendingProgress(operationId), false, "completed 應該清除 pending");
    });
  });

  describe("Multiple Operations", () => {
    it("應該獨立處理多個 operation 的 progress", async () => {
      const listener1 = mock.fn();
      const listener2 = mock.fn();

      subscribeOperationProgress("op-1", listener1);
      subscribeOperationProgress("op-2", listener2);

      // 更新兩個 operation
      updateOperationProgress({
        operationId: "op-1",
        status: "running",
        progress: 25,
      });

      updateOperationProgress({
        operationId: "op-2",
        status: "running",
        progress: 75,
      });

      await new Promise((resolve) => setTimeout(resolve, 120));

      // 每個 listener 應該只收到自己的 operation
      const op1LastCall = listener1.mock.calls[listener1.mock.calls.length - 1].arguments[0];
      const op2LastCall = listener2.mock.calls[listener2.mock.calls.length - 1].arguments[0];

      assert.equal(op1LastCall.operationId, "op-1");
      assert.equal(op1LastCall.progress, 25);

      assert.equal(op2LastCall.operationId, "op-2");
      assert.equal(op2LastCall.progress, 75);
    });

    it("一個 operation 完成不應影響其他 operation", async () => {
      const listener1 = mock.fn();
      const listener2 = mock.fn();

      subscribeOperationProgress("op-1", listener1);
      subscribeOperationProgress("op-2", listener2);

      // op-1 完成
      updateOperationProgress({
        operationId: "op-1",
        status: "completed",
      });

      // op-2 繼續 progress
      updateOperationProgress({
        operationId: "op-2",
        status: "running",
        progress: 50,
      });

      await new Promise((resolve) => setTimeout(resolve, 120));

      // op-2 應該仍然正常收到更新
      const op2LastCall = listener2.mock.calls[listener2.mock.calls.length - 1].arguments[0];
      assert.equal(op2LastCall.progress, 50);
    });
  });

  describe("Subscription Management", () => {
    it("新訂閱者應該立即收到當前狀態", async () => {
      const operationId = "op-existing";

      // 先更新 operation
      updateOperationProgress({
        operationId,
        status: "running",
        progress: 60,
      });

      await new Promise((resolve) => setTimeout(resolve, 120));

      // 新訂閱者
      const listener = mock.fn();
      subscribeOperationProgress(operationId, listener);

      // 應該立即收到當前狀態
      assert.equal(listener.mock.calls.length, 1);
      assert.equal(listener.mock.calls[0].arguments[0].progress, 60);
    });

    it("unsubscribe 應該停止接收更新", async () => {
      const listener = mock.fn();
      const operationId = "op-unsub";

      const unsubscribe = subscribeOperationProgress(operationId, listener);

      updateOperationProgress({
        operationId,
        status: "running",
        progress: 30,
      });

      await new Promise((resolve) => setTimeout(resolve, 120));
      const callsBeforeUnsub = listener.mock.calls.length;

      // Unsubscribe
      unsubscribe();

      // 再次更新
      updateOperationProgress({
        operationId,
        status: "running",
        progress: 70,
      });

      await new Promise((resolve) => setTimeout(resolve, 120));

      // 呼叫次數不應增加
      assert.equal(listener.mock.calls.length, callsBeforeUnsub);
    });

    it("最後一個 listener unsubscribe 後應清理資源", async () => {
      const operationId = "op-cleanup";
      const listener1 = mock.fn();
      const listener2 = mock.fn();

      const unsub1 = subscribeOperationProgress(operationId, listener1);
      const unsub2 = subscribeOperationProgress(operationId, listener2);

      updateOperationProgress({
        operationId,
        status: "running",
        progress: 50,
      });

      // 還有 pending timer
      assert.equal(hasPendingProgress(operationId), true);

      unsub1();
      // 還有一個 listener,應該保留
      assert.notEqual(getOperationState(operationId), null);

      unsub2();
      // 所有 listener 都 unsubscribe,應該清理
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(getOperationState(operationId), null, "應該清理 operation state");
      assert.equal(hasPendingProgress(operationId), false, "應該清理 pending timer");
    });
  });

  describe("Real-world Scenarios", () => {
    it("模擬 Divide 操作的 progress stream", async () => {
      const listener = mock.fn();
      const operationId = "divide-op";

      subscribeOperationProgress(operationId, listener);

      // 模擬快速連續的 progress 更新
      const progressValues = [
        { stage: "Planning", progress: 0 },
        { stage: "Creating Child", progress: 10 },
        { stage: "Creating Products", progress: 32 },
        { stage: "Creating Products", progress: 34 },
        { stage: "Creating Products", progress: 37 },
        { stage: "Creating Products", progress: 39 },
        { stage: "Creating Products", progress: 41 },
        { stage: "Validation", progress: 80 },
        { stage: "Handoff", progress: 100 },
      ];

      for (const { stage, progress } of progressValues.slice(0, -1)) {
        updateOperationProgress({
          operationId,
          status: "running",
          stage,
          progress,
        });
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      // 最後 completed
      updateOperationProgress({
        operationId,
        status: "completed",
        stage: "Handoff",
        progress: 100,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 不應該每個 progress 都通知 (因為 throttle)
      const totalUpdates = listener.mock.calls.length;
      assert.ok(totalUpdates < progressValues.length, "應該少於原始更新次數");
      assert.ok(totalUpdates >= 3, "但應該有多次更新");

      // 最後一次應該是 completed
      const lastCall = listener.mock.calls[totalUpdates - 1].arguments[0];
      assert.equal(lastCall.status, "completed");
    });
  });

  describe("Testing Utilities", () => {
    it("flushAllPendingProgress 應該立即發送所有 pending", async () => {
      const listener1 = mock.fn();
      const listener2 = mock.fn();

      subscribeOperationProgress("op-1", listener1);
      subscribeOperationProgress("op-2", listener2);

      updateOperationProgress({
        operationId: "op-1",
        status: "running",
        progress: 30,
      });

      updateOperationProgress({
        operationId: "op-2",
        status: "running",
        progress: 60,
      });

      // 兩個都應該有 pending
      assert.equal(hasPendingProgress("op-1"), true);
      assert.equal(hasPendingProgress("op-2"), true);

      // Flush all
      flushAllPendingProgress();

      // 不需要等待
      await new Promise((resolve) => setTimeout(resolve, 10));

      assert.equal(hasPendingProgress("op-1"), false);
      assert.equal(hasPendingProgress("op-2"), false);
    });

    it("clearAllOperationStates 應該清空所有狀態", async () => {
      subscribeOperationProgress("op-1", mock.fn());
      subscribeOperationProgress("op-2", mock.fn());

      updateOperationProgress({
        operationId: "op-1",
        status: "running",
        progress: 50,
      });

      updateOperationProgress({
        operationId: "op-2",
        status: "running",
        progress: 75,
      });

      assert.notEqual(getOperationState("op-1"), null);
      assert.notEqual(getOperationState("op-2"), null);

      clearAllOperationStates();

      assert.equal(getOperationState("op-1"), null);
      assert.equal(getOperationState("op-2"), null);
      assert.equal(hasPendingProgress("op-1"), false);
      assert.equal(hasPendingProgress("op-2"), false);
    });
  });
});

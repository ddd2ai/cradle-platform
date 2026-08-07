import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  registerResourceLoader,
  invalidateResource,
  flushImmediately,
  getPendingResources,
  isRefreshing,
  isDirty,
  clearPendingInvalidations,
  resetInvalidationState,
} from "../src/services/resource-invalidation.js";

describe("Resource Invalidation Queue", () => {
  beforeEach(() => {
    resetInvalidationState();
  });

  describe("Coalescing (合併)", () => {
    it("應該將 150ms 內的多個 invalidation 合併 (leading+trailing,最多 2 次)", async () => {
      const loader = mock.fn(() => Promise.resolve());
      registerResourceLoader("cells", loader);

      // Leading edge:第一個 invalidation 立即觸發 loader
      invalidateResource("cells");
      // 後續 4 次在 trailing window 內,會被合併成一次 trailing flush
      invalidateResource("cells");
      invalidateResource("cells");
      invalidateResource("cells");
      invalidateResource("cells");

      // 等待 200ms (超過 150ms trailing window)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Leading (1 次) + Trailing (1 次) = 最多 2 次,遠少於 5 次
      assert.ok(
        loader.mock.calls.length <= 2,
        `5 次 invalidation 應合併成 ≤2 次 loader 呼叫,實際: ${loader.mock.calls.length}`,
      );
      assert.equal(getPendingResources().length, 0);
    });

    it("應該合併不同資源的 invalidation 並批次刷新", async () => {
      const cellsLoader = mock.fn(() => Promise.resolve());
      const artifactsLoader = mock.fn(() => Promise.resolve());
      const cultivationLoader = mock.fn(() => Promise.resolve());

      registerResourceLoader("cells", cellsLoader);
      registerResourceLoader("artifacts", artifactsLoader);
      registerResourceLoader("cultivation", cultivationLoader);

      // Leading edge:cells 立即觸發
      invalidateResource("cells");
      // 其餘在 trailing window 內加入 (cells 再次加入表示有更新需求)
      invalidateResource("artifacts");
      invalidateResource("cells"); // 重複
      invalidateResource("cultivation");
      invalidateResource("artifacts"); // 重複

      await new Promise((resolve) => setTimeout(resolve, 200));

      // artifacts 和 cultivation 各只刷新 1 次 (只在 trailing 中)
      assert.equal(artifactsLoader.mock.calls.length, 1);
      assert.equal(cultivationLoader.mock.calls.length, 1);
      // cells 最多 2 次 (1 leading + 1 trailing)
      assert.ok(
        cellsLoader.mock.calls.length <= 2,
        `cells 應 ≤2 次,實際: ${cellsLoader.mock.calls.length}`,
      );
    });
  });

  describe("Deduplication (去重)", () => {
    it("應該防止並發的重複 request", async () => {
      const resolvers = [];
      let callIndex = 0;
      
      const loader = mock.fn(
        () => new Promise((resolve) => {
          resolvers[callIndex++] = resolve;
        })
      );

      registerResourceLoader("cells", loader);

      // 第一次 invalidation
      invalidateResource("cells");
      await new Promise((resolve) => setTimeout(resolve, 200));

      assert.equal(loader.mock.calls.length, 1);
      assert.equal(isRefreshing("cells"), true);

      // 在第一個 request 還在執行時,觸發第二次 invalidation
      invalidateResource("cells");
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 不應該觸發第二個 request (仍然是 1 次)
      assert.equal(loader.mock.calls.length, 1);
      assert.equal(isDirty("cells"), true);

      // 完成第一個 request
      resolvers[0]();
      
      // 需要時間讓 dirty check 執行並啟動第二次
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 因為有 dirty flag,應該再執行一次
      assert.equal(loader.mock.calls.length, 2, "應該執行第二次 (dirty refresh)");
      assert.equal(isRefreshing("cells"), true, "第二次應該正在執行中");
      
      // 完成第二次
      resolvers[1]();
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      assert.equal(isRefreshing("cells"), false, "所有請求完成後應該不再刷新");
      assert.equal(isDirty("cells"), false);
    });
  });

  describe("Immediate Flush", () => {
    it("應該立即刷新 trailing window 中的 pending invalidations", async () => {
      const loaderA = mock.fn(() => Promise.resolve());
      const loaderB = mock.fn(() => Promise.resolve());
      registerResourceLoader("cells", loaderA);
      registerResourceLoader("artifacts", loaderB);

      // Leading edge: cells 立即觸發 (loaderA call #1)
      invalidateResource("cells");
      // artifacts 進入 trailing pending (loaderA 已觸發,不在 pending)
      invalidateResource("artifacts");
      invalidateResource("cells"); // cells 再次進入 trailing pending

      // pending 現在有 ["artifacts", "cells"]
      assert.ok(getPendingResources().includes("artifacts"));

      // 立即 flush trailing pending (不等 150ms)
      flushImmediately();

      // 等待 Promise 解析
      await new Promise((resolve) => setTimeout(resolve, 10));

      // artifacts 應該已被刷新
      assert.equal(loaderB.mock.calls.length, 1);
      assert.equal(getPendingResources().length, 0);
    });
  });

  describe("Error Handling", () => {
    it("loader 失敗不應中斷 dirty check", async () => {
      let callCount = 0;
      let rejectFirst;
      let resolveSecond;
      
      const loader = mock.fn(() => {
        callCount++;
        if (callCount === 1) {
          return new Promise((_, reject) => {
            rejectFirst = reject;
          });
        }
        return new Promise((resolve) => {
          resolveSecond = resolve;
        });
      });

      registerResourceLoader("cells", loader);

      // 第一次刷新
      invalidateResource("cells");
      await new Promise((resolve) => setTimeout(resolve, 200));

      assert.equal(loader.mock.calls.length, 1);
      assert.equal(isRefreshing("cells"), true);

      // 在執行中標記 dirty
      invalidateResource("cells");
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 第一次失敗
      rejectFirst(new Error("Network error"));
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 應該因為 dirty 再執行一次
      assert.equal(loader.mock.calls.length, 2, "應該嘗試第二次刷新");
      
      // 完成第二次
      if (resolveSecond) {
        resolveSecond();
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it("應該處理未註冊的資源", async () => {
      // 不應該拋出錯誤
      assert.doesNotThrow(() => {
        invalidateResource("unknown-resource");
      });

      await new Promise((resolve) => setTimeout(resolve, 200));
      // 不應該有任何副作用
    });
  });

  describe("Testing Utilities", () => {
    it("clearPendingInvalidations 應該清空 trailing queue", () => {
      // Leading edge: cells 立即觸發,不進 pending
      invalidateResource("cells");
      // artifacts、cultivation 進入 trailing pending
      invalidateResource("artifacts");
      invalidateResource("cultivation");

      // trailing pending 應包含 artifacts 和 cultivation (cells 已被 leading edge 清走)
      assert.ok(getPendingResources().includes("artifacts"));
      assert.ok(getPendingResources().includes("cultivation"));

      clearPendingInvalidations();

      assert.equal(getPendingResources().length, 0);
    });

    it("resetInvalidationState 應該重置所有狀態", async () => {
      const loader = mock.fn(() => Promise.resolve());
      registerResourceLoader("cells", loader);

      invalidateResource("cells");
      await new Promise((resolve) => setTimeout(resolve, 200));

      resetInvalidationState();

      // 應該清空所有狀態
      assert.equal(getPendingResources().length, 0);
      
      // 再次 invalidate 不應觸發 loader (因為已 unregister)
      invalidateResource("cells");
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      assert.equal(loader.mock.calls.length, 1); // 只有 reset 前的一次
    });
  });

  describe("Real-world Scenarios", () => {
    it("模擬 Divide 操作的 event burst (leading edge + trailing coalesce)", async () => {
      const cellsLoader = mock.fn(() => Promise.resolve());
      const artifactsLoader = mock.fn(() => Promise.resolve());
      const cultivationLoader = mock.fn(() => Promise.resolve());

      registerResourceLoader("cells", cellsLoader);
      registerResourceLoader("artifacts", artifactsLoader);
      registerResourceLoader("cultivation", cultivationLoader);

      // 模擬 Divide 期間的事件序列 (每隔 10ms 一個事件)
      invalidateResource("cells"); // cell.updated (parent) → leading edge 立即刷新
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      invalidateResource("cells"); // cell.created (child) → trailing pending
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      invalidateResource("cells"); // cell.updated (parent again) → trailing pending
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      invalidateResource("cells"); // cell.updated (child) → trailing pending
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      invalidateResource("cultivation"); // cultivation.updated → trailing pending
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      invalidateResource("artifacts"); // artifacts.updated → trailing pending

      // 等待 trailing window 結束
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Leading edge: cells 刷新 1 次 (立即)
      // Trailing: cells + cultivation + artifacts 各刷新 1 次 (批次)
      // cells 最多 2 次,其他各 1 次
      assert.ok(
        cellsLoader.mock.calls.length <= 2,
        `cells 應 ≤2 次 (4 次 SSE events),實際: ${cellsLoader.mock.calls.length}`,
      );
      assert.equal(cultivationLoader.mock.calls.length, 1);
      assert.equal(artifactsLoader.mock.calls.length, 1);

      // 關鍵:沒有 leading edge 時,cells 會被觸發 4 次,現在最多 2 次
      const savedCellsRequests = 4 - cellsLoader.mock.calls.length;
      assert.ok(savedCellsRequests >= 2, `應至少省下 2 次 cells 請求,實際省下: ${savedCellsRequests}`);
    });
  });
});

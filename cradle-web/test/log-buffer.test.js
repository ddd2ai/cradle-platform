/**
 * Log Buffer 測試
 *
 * 驗證 log batching 機制:
 * - 高頻事件合併為批次更新
 * - 符合「monitoring console」感:使用者看到持續流入的 log,但 React 工作量大幅降低
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  bufferLogEntry,
  flushLogBuffer,
  subscribeLogBatch,
  getPendingLogCount,
  resetLogBuffer,
} from "../src/services/log-buffer.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeEntry(id, message = `log ${id}`) {
  return { id: `log-${id}`, timestamp: new Date().toISOString(), level: "info", message };
}

describe("Log Buffer - 基本 batching 行為", () => {
  afterEach(() => resetLogBuffer());

  it("多筆 log entry 在 flush 前累積於 buffer", () => {
    bufferLogEntry(makeEntry(1));
    bufferLogEntry(makeEntry(2));
    bufferLogEntry(makeEntry(3));

    // 尚未 flush,buffer 應有 3 筆
    assert.equal(getPendingLogCount(), 3);
  });

  it("flushLogBuffer 立即送出並清空 buffer", () => {
    const received = [];
    subscribeLogBatch((batch) => received.push(...batch));

    bufferLogEntry(makeEntry(1));
    bufferLogEntry(makeEntry(2));
    flushLogBuffer();

    assert.equal(getPendingLogCount(), 0);
    assert.equal(received.length, 2);
    assert.equal(received[0].id, "log-1");
    assert.equal(received[1].id, "log-2");
  });

  it("75ms 後自動 flush (timer-based)", async () => {
    const received = [];
    subscribeLogBatch((batch) => received.push(...batch));

    bufferLogEntry(makeEntry(1));
    bufferLogEntry(makeEntry(2));
    bufferLogEntry(makeEntry(3));

    // 尚未 flush
    assert.equal(received.length, 0);

    // 等待超過 75ms flush interval + 16ms rAF
    await sleep(120);

    // 應該已自動 flush
    assert.equal(received.length, 3, `應收到 3 筆,實際收到 ${received.length} 筆`);
    assert.equal(getPendingLogCount(), 0);
  });

  it("高頻事件合併為一次 flush (50 筆 → 1 次 listener 呼叫)", async () => {
    let listenerCallCount = 0;
    const allReceived = [];
    subscribeLogBatch((batch) => {
      listenerCallCount++;
      allReceived.push(...batch);
    });

    // 模擬 50 logs/sec (快速連發)
    for (let i = 1; i <= 50; i++) {
      bufferLogEntry(makeEntry(i));
    }

    await sleep(120);

    // 50 筆全收到
    assert.equal(allReceived.length, 50, `應收到 50 筆,實際 ${allReceived.length}`);
    // listener 被呼叫次數遠少於 50 次 (通常 1~2 次)
    assert.ok(
      listenerCallCount <= 3,
      `50 筆應合併成 ≤3 次 listener 呼叫,實際 ${listenerCallCount} 次`,
    );
  });
});

describe("Log Buffer - 效能對比驗證", () => {
  afterEach(() => resetLogBuffer());

  it("Before: 每筆 log 直接 setState → 50 次呼叫 (對照組)", () => {
    // 模擬舊的行為
    let setStateCallCount = 0;
    function legacyHandler(entry) {
      setStateCallCount++; // setState((prev) => [...prev, entry])
    }

    for (let i = 1; i <= 50; i++) {
      legacyHandler(makeEntry(i));
    }

    assert.equal(setStateCallCount, 50, "舊行為:50 筆 → 50 次 setState");
  });

  it("After: 批次 buffer → flush → 1 次 setState (新行為)", async () => {
    let batchFlushCount = 0;
    subscribeLogBatch(() => batchFlushCount++);

    for (let i = 1; i <= 50; i++) {
      bufferLogEntry(makeEntry(i));
    }

    await sleep(120);

    assert.ok(
      batchFlushCount <= 3,
      `新行為:50 筆 → ≤3 次 flush,實際 ${batchFlushCount} 次`,
    );
    const reduction = Math.round((1 - batchFlushCount / 50) * 100);
    assert.ok(reduction >= 90, `應減少 ≥90% setState 呼叫次數,實際減少 ${reduction}%`);
  });
});

describe("Log Buffer - 邊界情況", () => {
  afterEach(() => resetLogBuffer());

  it("空 buffer 時 flush 不呼叫 listener", () => {
    let called = false;
    subscribeLogBatch(() => { called = true; });
    flushLogBuffer();
    assert.equal(called, false, "空 buffer flush 不應呼叫 listener");
  });

  it("取消訂閱後不再收到更新", () => {
    const received = [];
    const unsubscribe = subscribeLogBatch((batch) => received.push(...batch));

    bufferLogEntry(makeEntry(1));
    flushLogBuffer();
    assert.equal(received.length, 1);

    unsubscribe();

    bufferLogEntry(makeEntry(2));
    flushLogBuffer();
    assert.equal(received.length, 1, "取消後不應收到新 log");
  });

  it("多個 subscriber 各自獨立收到相同批次", () => {
    const receivedA = [];
    const receivedB = [];
    subscribeLogBatch((batch) => receivedA.push(...batch));
    subscribeLogBatch((batch) => receivedB.push(...batch));

    bufferLogEntry(makeEntry(1));
    bufferLogEntry(makeEntry(2));
    flushLogBuffer();

    assert.equal(receivedA.length, 2);
    assert.equal(receivedB.length, 2);
  });

  it("連續多次 flush 不重複送出", () => {
    const received = [];
    subscribeLogBatch((batch) => received.push(...batch));

    bufferLogEntry(makeEntry(1));
    flushLogBuffer(); // 第一次 flush
    flushLogBuffer(); // 第二次 flush (應該是空的)

    assert.equal(received.length, 1, "第二次 flush 不應重複送出");
  });
});

describe("Log Buffer - Monitoring Console SLA 驗證", () => {
  afterEach(() => resetLogBuffer());

  it("Log event → visible < 200ms (符合 SLA)", async () => {
    const timestamps = { buffered: 0, flushed: 0 };
    subscribeLogBatch(() => { timestamps.flushed = Date.now(); });

    timestamps.buffered = Date.now();
    bufferLogEntry(makeEntry(1));

    await sleep(120); // 最多等 120ms

    const latency = timestamps.flushed - timestamps.buffered;
    assert.ok(
      latency < 200,
      `Log → visible 延遲應 < 200ms (SLA),實際 ${latency}ms`,
    );
  });
});

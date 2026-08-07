import { startTransition, useEffect, useRef, useState } from "react";
import { clearLogs, fetchLogs } from "../api/cradleClient";
import { subscribeToCradleEvents } from "../services/cradle-event-stream";
import { flushLogBuffer, subscribeLogBatch } from "../services/log-buffer";

export function LogsPage() {
  const [logCount, setLogCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState(null);
  const [copyMessage, setCopyMessage] = useState(null);
  const terminalRef = useRef(null);

  // 增量文字策略:
  // - 所有 log entries 存在 ref (不觸發 render)
  // - 格式化後的文字也存在 ref (增量 append,O(新增行數) 而非 O(全部))
  // - 只用 logCount state 來觸發 render (計數器)
  const logEntriesRef = useRef([]);
  const formattedTextRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    async function loadInitialLogs() {
      try {
        setIsLoading(true);
        const loadedLogs = await fetchLogs();

        if (cancelled) return;

        // 初始快照:重建全部文字,用 startTransition 標記為低優先更新
        const seen = new Set();
        const unique = loadedLogs.filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });

        logEntriesRef.current = unique.slice(-500);
        formattedTextRef.current = unique.map(formatLogLine).join("\n");

        startTransition(() => {
          setLogCount(unique.length);
          setError(null);
        });
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadInitialLogs();

    // logs.cleared 仍透過 general subscriber 收
    const unsubscribeEvents = subscribeToCradleEvents((event) => {
      if (cancelled || event.type !== "logs.cleared") return;
      logEntriesRef.current = [];
      formattedTextRef.current = "";
      startTransition(() => setLogCount(0));
    });

    // 批次訂閱:每 75ms 收到一批 entries,增量 append
    const unsubscribeLogs = subscribeLogBatch((batch) => {
      if (cancelled) return;

      const existingIds = new Set(logEntriesRef.current.map((e) => e.id));
      const newEntries = batch.filter((e) => !existingIds.has(e.id));
      if (newEntries.length === 0) return;

      const newLines = newEntries.map(formatLogLine).join("\n");
      const combined = [...logEntriesRef.current, ...newEntries].slice(-500);

      // 增量 append 文字 (O(新增行數),不重算舊行)
      formattedTextRef.current = formattedTextRef.current
        ? `${formattedTextRef.current}\n${newLines}`
        : newLines;

      // 保持 500 行上限:若超過,直接從 ref 重建全文
      if (combined.length < logEntriesRef.current.length + newEntries.length) {
        formattedTextRef.current = combined.map(formatLogLine).join("\n");
      }

      logEntriesRef.current = combined;

      // 低優先更新:更新計數器觸發 re-render (只是讓 React 知道有新內容)
      startTransition(() => setLogCount(combined.length));
    });

    return () => {
      cancelled = true;
      unsubscribeEvents();
      unsubscribeLogs();
    };
  }, []);

  // rAF auto-scroll:對齊瀏覽器繪製週期,不在每次 render 都同步 scrollTop
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const rafId = requestAnimationFrame(() => {
      terminal.scrollTop = terminal.scrollHeight;
    });

    return () => cancelAnimationFrame(rafId);
  }, [logCount]); // logCount 變化才需要 scroll

  useEffect(() => {
    if (!copyMessage) return undefined;
    const timerId = window.setTimeout(() => setCopyMessage(null), 1800);
    return () => window.clearTimeout(timerId);
  }, [copyMessage]);

  async function handleCopyLogs() {
    try {
      await navigator.clipboard.writeText(formattedTextRef.current);
      setCopyMessage("Copied");
    } catch {
      setCopyMessage("Copy failed");
    }
  }

  async function handleClearLogs() {
    try {
      setIsClearing(true);
      setError(null);
      flushLogBuffer(); // 清空 buffer 中未 flush 的 entries
      await clearLogs();
      logEntriesRef.current = [];
      formattedTextRef.current = "";
      startTransition(() => setLogCount(0));
    } catch (clearError) {
      setError(clearError.message);
    } finally {
      setIsClearing(false);
    }
  }

  const displayText = isLoading
    ? "Loading logs..."
    : formattedTextRef.current || "No console output yet.";

  return (
    <section className="platform-page logs-page">
      <div className="page-heading">
        <div>
          <h1>Logs</h1>
          <p>Cradle Terminal</p>
        </div>
        <div className="logs-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleCopyLogs}
            disabled={logCount === 0}
          >
            Copy
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleClearLogs}
            disabled={isClearing || logCount === 0}
          >
            {isClearing ? "Clearing..." : "Clear Log"}
          </button>
        </div>
      </div>

      {error && <div className="action-feedback-item error">x {error}</div>}
      {copyMessage && (
        <div className="action-feedback-item success">{copyMessage}</div>
      )}

      <div className="terminal-shell">
        <pre ref={terminalRef} className="terminal-output">{displayText}</pre>
      </div>
    </section>
  );
}

function formatLogLine(log) {
  const time = formatTime(log.timestamp);
  const level = String(log.level ?? "info").toUpperCase().padEnd(5, " ");
  const message = String(log.message ?? "");

  return `${time}  [${level}] ${message}`;
}

function formatTime(timestamp) {
  if (!timestamp) {
    return "--:--:--";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

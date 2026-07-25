import { useEffect, useMemo, useRef, useState } from "react";
import { clearLogs, fetchLogs } from "../api/cradleClient";

const REFRESH_INTERVAL_MS = 1500;

export function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState(null);
  const [copyMessage, setCopyMessage] = useState(null);
  const terminalRef = useRef(null);

  const terminalText = useMemo(
    () => logs.map(formatLogLine).join("\n"),
    [logs],
  );

  async function loadLogs({ showLoading = false } = {}) {
    try {
      if (showLoading) {
        setIsLoading(true);
      }

      const loadedLogs = await fetchLogs();
      setLogs(loadedLogs);
      setError(null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialLogs() {
      try {
        setIsLoading(true);
        const loadedLogs = await fetchLogs();

        if (!cancelled) {
          setLogs(loadedLogs);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadInitialLogs();

    const timerId = window.setInterval(() => {
      if (!cancelled) {
        loadLogs();
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;

    if (terminal) {
      terminal.scrollTop = terminal.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (!copyMessage) return undefined;

    const timerId = window.setTimeout(() => setCopyMessage(null), 1800);
    return () => window.clearTimeout(timerId);
  }, [copyMessage]);

  async function handleCopyLogs() {
    try {
      await navigator.clipboard.writeText(terminalText);
      setCopyMessage("Copied");
    } catch {
      setCopyMessage("Copy failed");
    }
  }

  async function handleClearLogs() {
    try {
      setIsClearing(true);
      setError(null);
      const clearedLogs = await clearLogs();
      setLogs(clearedLogs);
    } catch (clearError) {
      setError(clearError.message);
    } finally {
      setIsClearing(false);
    }
  }

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
            disabled={logs.length === 0}
          >
            Copy
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleClearLogs}
            disabled={isClearing || logs.length === 0}
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
        <div className="terminal-titlebar">
          <div className="terminal-lights" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="terminal-title">Cradle Console</div>
          <div className="terminal-count">{logs.length} lines</div>
        </div>
        <pre ref={terminalRef} className="terminal-output">{isLoading
          ? "Connecting to Cradle Console..."
          : terminalText || "No console output yet."}</pre>
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

import util from "util";

const DEFAULT_LIMIT = 500;

export class LogBuffer {
  constructor({
    limit = DEFAULT_LIMIT,
    now = () => new Date(),
    eventStream = null,
  } = {}) {
    this.limit = limit;
    this.now = now;
    this.eventStream = eventStream;
    this.entries = [];
    this.nextId = 1;
  }

  append({ level = "info", args = [] } = {}) {
    const message = util.format(...args);
    const entry = {
      id: this.nextId,
      level,
      timestamp: this.now().toISOString(),
      message,
    };

    this.nextId += 1;
    this.entries.push(entry);

    if (this.entries.length > this.limit) {
      this.entries.splice(0, this.entries.length - this.limit);
    }

    this.eventStream?.publish("log.appended", { entry });

    return entry;
  }

  list() {
    return [...this.entries];
  }

  clear() {
    this.entries = [];
    this.eventStream?.publish("logs.cleared", {});
  }
}

export function installConsoleLogBuffer({
  logBuffer = new LogBuffer(),
  consoleObject = console,
} = {}) {
  const original = {
    log: consoleObject.log.bind(consoleObject),
    info: consoleObject.info.bind(consoleObject),
    warn: consoleObject.warn.bind(consoleObject),
    error: consoleObject.error.bind(consoleObject),
  };

  for (const level of Object.keys(original)) {
    consoleObject[level] = (...args) => {
      logBuffer.append({ level: normalizeLevel(level), args });
      original[level](...args);
    };
  }

  return {
    logBuffer,
    restore() {
      consoleObject.log = original.log;
      consoleObject.info = original.info;
      consoleObject.warn = original.warn;
      consoleObject.error = original.error;
    },
  };
}

function normalizeLevel(level) {
  if (level === "log") {
    return "info";
  }

  return level;
}

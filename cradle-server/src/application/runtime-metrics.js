const DEFAULT_SAMPLE_LIMIT = 512;

export class RuntimeMetrics {
  constructor({ sampleLimit = DEFAULT_SAMPLE_LIMIT, now = () => new Date() } = {}) {
    this.sampleLimit = sampleLimit;
    this.now = now;
    this.startedAt = this.now().toISOString();
    this.counters = new Map();
    this.gauges = new Map();
    this.samples = new Map();
  }

  increment(name, value = 1, labels = {}) {
    const key = metricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  gauge(name, value, labels = {}) {
    this.gauges.set(metricKey(name, labels), Number(value) || 0);
  }

  observe(name, value, labels = {}) {
    const key = metricKey(name, labels);
    const values = this.samples.get(key) ?? [];
    values.push(Number(value) || 0);
    if (values.length > this.sampleLimit) {
      values.splice(0, values.length - this.sampleLimit);
    }
    this.samples.set(key, values);
  }

  snapshot() {
    return {
      startedAt: this.startedAt,
      observedAt: this.now().toISOString(),
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      distributions: Object.fromEntries(
        [...this.samples].map(([key, values]) => [key, summarize(values)])
      ),
    };
  }
}

function metricKey(name, labels) {
  const suffix = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
  return suffix ? `${name}{${suffix}}` : name;
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
  return {
    count: sorted.length,
    min: sorted[0] ?? 0,
    max: sorted.at(-1) ?? 0,
    p50: percentile(0.5),
    p95: percentile(0.95),
  };
}

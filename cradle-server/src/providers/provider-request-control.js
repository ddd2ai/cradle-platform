export function createProviderRequestControl({
  signal: parentSignal = null,
  timeoutMs,
  label = "LLM provider",
} = {}) {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort(abortReason(parentSignal, `${label} request cancelled`));
  let timer = null;

  if (parentSignal?.aborted) {
    onParentAbort();
  } else {
    parentSignal?.addEventListener("abort", onParentAbort, { once: true });
  }

  if (!controller.signal.aborted && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timer = setTimeout(() => {
      controller.abort(new Error(`${label} timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    timer.unref?.();
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      parentSignal?.removeEventListener("abort", onParentAbort);
    },
    error(fallback) {
      return abortReason(controller.signal, fallback ?? `${label} request cancelled`);
    },
  };
}

export function raceWithSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortReason(signal));

  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

export function abortReason(signal, fallback = "LLM request cancelled") {
  return signal?.reason instanceof Error ? signal.reason : new Error(fallback);
}

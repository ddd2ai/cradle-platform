export function abortReason(signal, fallback = "Operation cancelled") {
  return signal?.reason instanceof Error
    ? signal.reason
    : Object.assign(new Error(fallback), { code: "OPERATION_CANCELLED" });
}

export function throwIfAborted(signal, fallback) {
  if (signal?.aborted) throw abortReason(signal, fallback);
}

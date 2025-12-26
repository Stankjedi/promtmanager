function getTauri() {
  try {
    return globalThis.__TAURI__ ?? null;
  } catch {
    return null;
  }
}

export function isTauri() {
  const t = getTauri();
  return !!(t && (typeof t.invoke === "function" || typeof t?.core?.invoke === "function"));
}

export async function tauriInvoke(command, args = {}) {
  const t = getTauri();
  const invoke = t?.invoke ?? t?.core?.invoke;
  if (typeof invoke !== "function") {
    throw new Error("Tauri invoke is not available in this environment.");
  }
  return invoke(command, args);
}

export async function tauriListen(eventName, handler) {
  const t = getTauri();
  const listen = t?.event?.listen;
  if (typeof listen !== "function") {
    throw new Error("Tauri event.listen is not available in this environment.");
  }
  return listen(eventName, handler);
}


function normalizeKeyList(keys) {
  if (keys === null || keys === undefined) return null;
  if (Array.isArray(keys)) return keys.filter((k) => typeof k === "string" && k);
  if (typeof keys === "string") return keys ? [keys] : [];
  if (keys && typeof keys === "object") {
    return Object.keys(keys).filter((k) => typeof k === "string" && k);
  }
  return [];
}

function safeJsonParse(raw) {
  if (typeof raw !== "string") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function safeJsonStringify(value) {
  return JSON.stringify(value);
}

export function getLocal(keys) {
  return new Promise((resolve, reject) => {
    try {
      const wanted = normalizeKeyList(keys);
      const out = {};

      // Handle default values if keys is an object
      if (keys && typeof keys === "object" && !Array.isArray(keys)) {
        Object.assign(out, keys);
      }

      if (wanted === null) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          const raw = localStorage.getItem(k);
          if (raw === null) continue;
          out[k] = safeJsonParse(raw);
        }
        resolve(out);
        return;
      }

      for (const k of wanted) {
        const raw = localStorage.getItem(k);
        if (raw === null) continue;
        out[k] = safeJsonParse(raw);
      }

      resolve(out);
    } catch (e) {
      reject(e);
    }
  });
}

function toErrorMessage(err) {
  if (!err) return "";
  if (err instanceof Error) return err.message || "";
  if (typeof err === "string") return err;
  return String(err);
}

function isQuotaErrorMessage(msg) {
  const s = String(msg || "");
  return /quota/i.test(s) || /exceeded/i.test(s);
}

export function storageErrorToUserMessage(err, action = "저장") {
  const msg = toErrorMessage(err).trim();
  const a = typeof action === "string" && action.trim() ? action.trim() : "작업";

  if (isQuotaErrorMessage(msg)) {
    return `${a}에 실패했습니다(저장 공간 한도). 일부 데이터를 줄인 뒤 다시 시도하세요. 자세한 내용은 콘솔을 확인하세요.`;
  }

  return `${a}에 실패했습니다. 브라우저 정책/권한을 확인하고 다시 시도하세요. 자세한 내용은 콘솔을 확인하세요.`;
}

export function setLocal(obj) {
  return new Promise((resolve, reject) => {
    try {
      const payload = obj && typeof obj === "object" ? obj : {};
      for (const [k, v] of Object.entries(payload)) {
        if (!k) continue;
        if (v === undefined) {
          localStorage.removeItem(k);
          continue;
        }
        localStorage.setItem(k, safeJsonStringify(v));
      }
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

export function removeLocal(keys) {
  return new Promise((resolve, reject) => {
    try {
      const list = normalizeKeyList(keys) ?? [];
      for (const k of list) {
        localStorage.removeItem(k);
      }
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

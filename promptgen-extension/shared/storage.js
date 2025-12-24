export function getLocal(keys) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(keys, (items) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(items);
      });
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
      chrome.storage.local.set(obj, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

export function removeLocal(keys) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

export async function copyTextToClipboard(text) {
  const s = typeof text === "string" ? text : String(text ?? "");

  // 1) 최신 Clipboard API
  let clipboardApiError = null;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(s);
      return { ok: true, method: "clipboard-api" };
    }
  } catch (e) {
    clipboardApiError = e instanceof Error ? e.message : String(e ?? "unknown");
  }

  // 2) fallback: execCommand('copy')
  const fallbackRes = await fallbackCopy(s);
  if (fallbackRes.ok) return fallbackRes;

  if (clipboardApiError) {
    return {
      ok: false,
      method: "execCommand",
      error: `clipboard-api failed: ${clipboardApiError}; execCommand failed: ${fallbackRes.error}`
    };
  }

  return fallbackRes;
}

async function fallbackCopy(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;

    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    ta.setAttribute("readonly", "true");

    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);

    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) return { ok: true, method: "execCommand" };
    return { ok: false, method: "execCommand", error: "execCommand returned false" };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e ?? "unknown");
    return { ok: false, method: "execCommand", error: err };
  }
}

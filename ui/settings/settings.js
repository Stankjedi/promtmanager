import { isTauri, tauriInvoke } from "../shared/tauri.js";

const DEFAULT_TOGGLE = "Ctrl+Shift+O";
const DEFAULT_PASTE = "Ctrl+Shift+V";

const toggleOverlayInput = document.getElementById("toggleOverlayInput");
const pasteAssetInput = document.getElementById("pasteAssetInput");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const backToPanelBtn = document.getElementById("backToPanelBtn");
const formErrors = document.getElementById("formErrors");
const statusEl = document.getElementById("status");

let currentCapturingInput = null;

/**
 * Convert a KeyboardEvent to a shortcut string like "Ctrl+Shift+O"
 */
function keyEventToShortcut(e) {
    const parts = [];

    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");

    // Get the key
    let key = e.key;

    // Skip if only modifier keys are pressed
    if (["Control", "Alt", "Shift", "Meta"].includes(key)) {
        return null;
    }

    // Normalize key names
    if (key === " ") key = "Space";
    else if (key.length === 1) key = key.toUpperCase();
    else if (key === "ArrowUp") key = "Up";
    else if (key === "ArrowDown") key = "Down";
    else if (key === "ArrowLeft") key = "Left";
    else if (key === "ArrowRight") key = "Right";
    else if (key === "Escape") key = "Escape";
    else if (key === "Enter") key = "Enter";
    else if (key === "Backspace") key = "Backspace";
    else if (key === "Delete") key = "Delete";
    else if (key === "Tab") key = "Tab";
    else if (key === "Home") key = "Home";
    else if (key === "End") key = "End";
    else if (key === "PageUp") key = "PageUp";
    else if (key === "PageDown") key = "PageDown";
    else if (key === "Insert") key = "Insert";
    else if (key.startsWith("F") && !isNaN(key.slice(1))) {
        // F1-F12 keys - keep as is
    }

    // Require at least one modifier for global shortcuts
    if (parts.length === 0) {
        return null;
    }

    parts.push(key);
    return parts.join("+");
}

function showStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.className = "status " + (isError ? "error" : "success");

    setTimeout(() => {
        statusEl.textContent = "";
        statusEl.className = "status";
    }, 3000);
}

function showError(message) {
    formErrors.textContent = message;
    formErrors.classList.remove("hidden");
}

function hideError() {
    formErrors.textContent = "";
    formErrors.classList.add("hidden");
}

async function loadSettings() {
    if (!isTauri()) {
        // Fallback for non-Tauri environment
        toggleOverlayInput.value = DEFAULT_TOGGLE;
        pasteAssetInput.value = DEFAULT_PASTE;
        return;
    }

    try {
        const settings = await tauriInvoke("get_shortcuts");
        toggleOverlayInput.value = settings.toggle_overlay || DEFAULT_TOGGLE;
        pasteAssetInput.value = settings.paste_asset || DEFAULT_PASTE;
    } catch (e) {
        console.error("Failed to load settings:", e);
        toggleOverlayInput.value = DEFAULT_TOGGLE;
        pasteAssetInput.value = DEFAULT_PASTE;
    }
}

async function saveSettings() {
    hideError();

    const toggleOverlay = toggleOverlayInput.value.trim();
    const pasteAsset = pasteAssetInput.value.trim();

    if (!toggleOverlay || !pasteAsset) {
        showError("모든 단축키를 설정해주세요.");
        return;
    }

    if (!isTauri()) {
        showStatus("Tauri 환경이 아닙니다.", true);
        return;
    }

    try {
        await tauriInvoke("update_shortcuts", {
            settings: {
                toggle_overlay: toggleOverlay,
                paste_asset: pasteAsset,
            },
        });
        showStatus("저장되었습니다. 새 단축키가 적용되었습니다.");
    } catch (e) {
        console.error("Failed to save settings:", e);
        showError("저장 실패: " + (e.message || e));
    }
}

function resetToDefaults() {
    toggleOverlayInput.value = DEFAULT_TOGGLE;
    pasteAssetInput.value = DEFAULT_PASTE;
    showStatus("기본값으로 복원되었습니다. 저장 버튼을 눌러 적용하세요.");
}

function setupShortcutInput(input) {
    input.addEventListener("focus", () => {
        currentCapturingInput = input;
        input.classList.add("capturing");
        input.placeholder = "키를 누르세요...";
    });

    input.addEventListener("blur", () => {
        if (currentCapturingInput === input) {
            currentCapturingInput = null;
        }
        input.classList.remove("capturing");
        input.placeholder = "클릭 후 키 입력...";
    });

    input.addEventListener("keydown", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const shortcut = keyEventToShortcut(e);
        if (shortcut) {
            input.value = shortcut;
            input.blur();
            hideError();
        }
    });
}

function navigateToPanel() {
    window.location.href = "../sidepanel/sidepanel.html";
}

// Initialize
setupShortcutInput(toggleOverlayInput);
setupShortcutInput(pasteAssetInput);

saveBtn.addEventListener("click", saveSettings);
resetBtn.addEventListener("click", resetToDefaults);
backToPanelBtn.addEventListener("click", navigateToPanel);

loadSettings();

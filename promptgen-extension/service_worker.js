// service_worker.js (MV3 Service Worker, ES Module)

const MENU_ID_SET_ASSET = "pg_set_asset_from_selection";

chrome.runtime.onInstalled.addListener(async () => {
  try {
    if (chrome.sidePanel?.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch (e) {
    // 일부 환경에서 실패할 수 있으므로 무시(패널은 사용자가 수동으로 열 수도 있음)
    console.warn("setPanelBehavior failed:", e);
  }

  // 우클릭 메뉴 생성(선택 텍스트 컨텍스트에서만)
  try {
    chrome.contextMenus.create({
      id: MENU_ID_SET_ASSET,
      title: "프롬프트 생성기: 선택 텍스트를 에셋(ASSET)으로 설정",
      contexts: ["selection"]
    });
  } catch (e) {
    console.warn("contextMenus.create failed:", e);
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID_SET_ASSET) return;

  const text = (info.selectionText || "").trim();
  if (!text) return;

  // 1) 패널이 열려있지 않아도 적용되도록, pending 업데이트를 storage.local에 저장
  try {
    await chrome.storage.local.set({
      "pg.pendingUpdate": { fieldId: "asset", value: text, ts: Date.now() }
    });
  } catch (e) {
    console.warn("Failed to write pendingUpdate:", e);
  }

  // 2) 가능한 경우: 유저 제스처(컨텍스트 메뉴)로 사이드 패널을 열기
  try {
    const windowId = tab?.windowId;
    if (chrome.sidePanel?.open && typeof windowId === "number") {
      await chrome.sidePanel.open({ windowId });
    }
  } catch (e) {
    console.warn("sidePanel.open failed:", e);
  }

  // 3) 패널이 이미 열려 있다면 즉시 반영되도록 메시지도 보냄(베스트 에포트)
  try {
    await chrome.runtime.sendMessage({
      type: "PG_SET_FIELD",
      fieldId: "asset",
      value: text
    });
  } catch {
    // 수신자가 없을 수 있으므로 무시
  }
});

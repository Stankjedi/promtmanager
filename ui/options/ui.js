export function el(id) {
  return document.getElementById(id);
}

let globalStatusTimer = null;
export function setGlobalStatus(text) {
  const element = el("globalStatus");
  element.textContent = text || "";

  if (globalStatusTimer) clearTimeout(globalStatusTimer);
  if (text) {
    globalStatusTimer = setTimeout(() => {
      if (element.textContent === text) {
        element.textContent = "";
      }
    }, 5000);
  }
}

export function setBox(boxId, title, items) {
  const box = el(boxId);
  box.innerHTML = "";
  if (!items || items.length === 0) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");

  const t = document.createElement("div");
  t.style.fontWeight = "800";
  t.style.marginBottom = "6px";
  t.textContent = title;
  box.appendChild(t);

  const ul = document.createElement("ul");
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = String(item);
    ul.appendChild(li);
  }
  box.appendChild(ul);
}

export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}


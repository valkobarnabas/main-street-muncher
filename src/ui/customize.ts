import {
  fileToSpriteDataUrl,
  getAppearance,
  onAppearanceChange,
  resetAppearance,
  setAppearance,
} from "./appearance";
import { showToast } from "./hud";

export function initCustomizeUi(): void {
  const panel = document.getElementById("customize-panel");
  const openBtns = document.querySelectorAll("[data-open-customize]");
  const closeBtns = document.querySelectorAll("#customize-close, [data-close-customize]");
  const resetBtn = document.getElementById("customize-reset");
  const roadInput = document.getElementById("customize-road");
  const fillInput = document.getElementById("customize-fill");
  const dotInput = document.getElementById("customize-dot");
  const playerInput = document.getElementById("customize-player");
  const chaserInput = document.getElementById("customize-chaser");
  const clearPlayer = document.getElementById("customize-clear-player");
  const clearChaser = document.getElementById("customize-clear-chaser");
  const playerPreview = document.getElementById("customize-player-preview");
  const chaserPreview = document.getElementById("customize-chaser-preview");

  if (
    !(panel instanceof HTMLElement) ||
    !(roadInput instanceof HTMLInputElement) ||
    !(fillInput instanceof HTMLInputElement) ||
    !(dotInput instanceof HTMLInputElement) ||
    !(playerInput instanceof HTMLInputElement) ||
    !(chaserInput instanceof HTMLInputElement)
  ) {
    return;
  }

  const syncForm = () => {
    const a = getAppearance();
    roadInput.value = a.roadOutline;
    fillInput.value = a.roadFill;
    dotInput.value = a.dot;
    setPreview(playerPreview, a.playerImage, "Default car");
    setPreview(chaserPreview, a.chaserImage, "Default cone");
  };

  syncForm();
  onAppearanceChange(syncForm);

  const open = () => {
    syncForm();
    panel.classList.remove("hidden");
  };
  const close = () => panel.classList.add("hidden");

  for (const btn of openBtns) {
    btn.addEventListener("click", open);
  }
  for (const btn of closeBtns) {
    btn.addEventListener("click", close);
  }
  panel.addEventListener("click", (e) => {
    if (e.target === panel) close();
  });

  roadInput.addEventListener("input", () => setAppearance({ roadOutline: roadInput.value }));
  fillInput.addEventListener("input", () => setAppearance({ roadFill: fillInput.value }));
  dotInput.addEventListener("input", () => setAppearance({ dot: dotInput.value }));

  playerInput.addEventListener("change", () => {
    void handleImagePick(playerInput, "playerImage");
  });
  chaserInput.addEventListener("change", () => {
    void handleImagePick(chaserInput, "chaserImage");
  });

  clearPlayer?.addEventListener("click", () => {
    setAppearance({ playerImage: null });
    playerInput.value = "";
    showToast("Player icon reset to default car.");
  });
  clearChaser?.addEventListener("click", () => {
    setAppearance({ chaserImage: null });
    chaserInput.value = "";
    showToast("Chaser icon reset to default cone.");
  });

  resetBtn?.addEventListener("click", () => {
    resetAppearance();
    playerInput.value = "";
    chaserInput.value = "";
    showToast("Customization reset to defaults.");
  });
}

async function handleImagePick(
  input: HTMLInputElement,
  key: "playerImage" | "chaserImage",
): Promise<void> {
  const file = input.files?.[0];
  if (!file) return;
  try {
    const dataUrl = await fileToSpriteDataUrl(file);
    setAppearance({ [key]: dataUrl });
    showToast("Custom icon saved for this browser.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not use that image.";
    showToast(msg);
    input.value = "";
  }
}

function setPreview(
  el: HTMLElement | null,
  dataUrl: string | null,
  emptyLabel: string,
): void {
  if (!el) return;
  if (dataUrl) {
    el.replaceChildren();
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "";
    el.append(img);
  } else {
    el.textContent = emptyLabel;
  }
}

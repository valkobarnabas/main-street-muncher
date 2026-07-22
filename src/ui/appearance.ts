const STORAGE_KEY = "main-street-appearance-v1";
const MAX_IMAGE_SIDE = 128;
const MAX_DATA_URL_CHARS = 180_000;

export type Appearance = {
  roadOutline: string;
  roadFill: string;
  dot: string;
  playerImage: string | null;
  chaserImage: string | null;
};

export const DEFAULT_APPEARANCE: Appearance = {
  roadOutline: "#333366",
  roadFill: "#000000",
  dot: "#80BC00",
  playerImage: null,
  chaserImage: null,
};

let current: Appearance = loadAppearance();
const listeners = new Set<() => void>();

function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    const parsed = JSON.parse(raw) as Partial<Appearance>;
    return {
      roadOutline: sanitizeColor(parsed.roadOutline) ?? DEFAULT_APPEARANCE.roadOutline,
      roadFill: sanitizeColor(parsed.roadFill) ?? DEFAULT_APPEARANCE.roadFill,
      dot: sanitizeColor(parsed.dot) ?? DEFAULT_APPEARANCE.dot,
      playerImage: sanitizeDataUrl(parsed.playerImage),
      chaserImage: sanitizeDataUrl(parsed.chaserImage),
    };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

function sanitizeColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : null;
}

function sanitizeDataUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("data:image/")) return null;
  if (value.length > MAX_DATA_URL_CHARS) return null;
  return value;
}

export function getAppearance(): Appearance {
  return current;
}

export function setAppearance(patch: Partial<Appearance>): void {
  current = {
    ...current,
    ...patch,
    roadOutline: sanitizeColor(patch.roadOutline) ?? current.roadOutline,
    roadFill: sanitizeColor(patch.roadFill) ?? current.roadFill,
    dot: sanitizeColor(patch.dot) ?? current.dot,
    playerImage:
      patch.playerImage === undefined
        ? current.playerImage
        : sanitizeDataUrl(patch.playerImage),
    chaserImage:
      patch.chaserImage === undefined
        ? current.chaserImage
        : sanitizeDataUrl(patch.chaserImage),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Quota exceeded — keep in-memory prefs
  }
  applyCssVars(current);
  for (const fn of listeners) fn();
}

export function resetAppearance(): void {
  current = { ...DEFAULT_APPEARANCE };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  applyCssVars(current);
  for (const fn of listeners) fn();
}

export function onAppearanceChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function applyCssVars(a: Appearance = current): void {
  const root = document.documentElement;
  root.style.setProperty("--road", a.roadOutline);
  root.style.setProperty("--accent", a.dot);
}

/** Resize/compress an image file to a small PNG data URL for localStorage. */
export function fileToSpriteDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(
        1,
        MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight, 1),
      );
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process that image."));
        return;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/png");
      if (dataUrl.length > MAX_DATA_URL_CHARS) {
        reject(new Error("Image is still too large after shrinking — try a simpler PNG."));
        return;
      }
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

/** Lighter tint of a hex color for power dots. */
export function lightenHex(hex: string, amount = 0.35): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

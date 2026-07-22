import "leaflet/dist/leaflet.css";
import "./style.css";
import { createMap, getViewBounds, lockMap } from "./map/mapApp";
import { searchPlace } from "./osm/nominatim";
import { prefetchStreets } from "./osm/overpass";
import { buildMaze } from "./maze/build";
import { validateViewSize } from "./maze/validate";
import { startGame, type GameSession } from "./game/loop";
import { setHud, setPlayingUi, showToast } from "./ui/hud";
import { applyCssVars } from "./ui/appearance";
import { initCustomizeUi } from "./ui/customize";

applyCssVars();
initCustomizeUi();

const splash = document.getElementById("splash");
const splashPlay = document.getElementById("splash-play");
const splashAbout = document.getElementById("splash-about");
const aboutPanel = document.getElementById("about-panel");
const appEl = document.getElementById("app");
const menuBtn = document.getElementById("menu-btn");

function showMenu(): void {
  void exitGame().finally(() => {
    appEl?.classList.add("hidden");
    splash?.classList.remove("hidden");
    aboutPanel?.classList.add("hidden");
  });
}

splashPlay?.addEventListener("click", () => {
  splash?.classList.add("hidden");
  appEl?.classList.remove("hidden");
  // Map was created hidden — force a size pass
  requestAnimationFrame(() => {
    map.invalidateSize({ animate: false });
    schedulePrefetch();
    showToast("Zoom to a neighborhood, then press PLAY.", 4000);
  });
});

splashAbout?.addEventListener("click", () => {
  aboutPanel?.classList.toggle("hidden");
});

menuBtn?.addEventListener("click", () => {
  showMenu();
});

const mapEl = document.getElementById("map");
const canvasEl = document.getElementById("game-canvas");
const fabEl = document.getElementById("play-fab");
const formEl = document.getElementById("search-form");
const inputEl = document.getElementById("search-input");
const exitBtn = document.getElementById("exit-btn");

if (
  !(mapEl instanceof HTMLElement) ||
  !(canvasEl instanceof HTMLCanvasElement) ||
  !(fabEl instanceof HTMLButtonElement) ||
  !(formEl instanceof HTMLFormElement) ||
  !(inputEl instanceof HTMLInputElement)
) {
  throw new Error("Missing required DOM nodes");
}

const canvas = canvasEl;
const fab = fabEl;
const form = formEl;
const input = inputEl;
const map = createMap(mapEl);
let session: GameSession | null = null;
let starting = false;
let prefetchTimer = 0;

function waitFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function layoutForPlay(playing: boolean): Promise<void> {
  setPlayingUi(playing);
  await waitFrame();
  map.invalidateSize({ animate: false });
  await waitFrame();
}

function schedulePrefetch(): void {
  window.clearTimeout(prefetchTimer);
  prefetchTimer = window.setTimeout(() => {
    prefetchStreets(getViewBounds(map));
  }, 280);
}

map.on("moveend", schedulePrefetch);
map.on("zoomend", schedulePrefetch);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  try {
    const results = await searchPlace(q);
    if (results.length === 0) {
      showToast("No places found for that search.");
      return;
    }
    const r = results[0]!;
    map.flyTo([r.lat, r.lon], Math.max(map.getZoom(), 17), { duration: 1.2 });
  } catch {
    showToast("Search failed — check your connection and try again.");
  }
});

async function startPlay(): Promise<void> {
  if (starting || session) return;

  const sizeCheck = validateViewSize(getViewBounds(map));
  if (!sizeCheck.ok) {
    showToast(sizeCheck.reason);
    return;
  }

  starting = true;
  fab.disabled = true;
  showToast("Loading streets…");

  try {
    // Banner + size first so streets match the on-screen view exactly
    await layoutForPlay(true);
    setHud(0, 5, "Loading…");
    map.invalidateSize({ animate: false });
    await waitFrame();

    const bounds = getViewBounds(map);
    const again = validateViewSize(bounds);
    if (!again.ok) {
      showToast(again.reason);
      await layoutForPlay(false);
      return;
    }

    const result = await buildMaze(bounds);
    if (!result.ok) {
      showToast(result.reason);
      await layoutForPlay(false);
      return;
    }

    const { maze, origin } = result;
    lockMap(map, true);
    setHud(0, 5, "Get ready…");
    showToast("Spot the chasers — then munch the dots!", 2800);

    session = startGame(map, maze, origin, canvas, {
      onScore: (score, lives, status) => setHud(score, lives, status),
      onEnd: (outcome) => {
        if (outcome === "won") {
          showToast("Route cleared! Every dot is gone.");
        } else {
          showToast("Caught! Try a tighter block.");
        }
      },
    });
  } catch (err) {
    console.error(err);
    showToast("Something went wrong building the maze.");
    session?.stop();
    session = null;
    lockMap(map, false);
    await layoutForPlay(false);
  } finally {
    starting = false;
    fab.disabled = false;
  }
}

async function exitGame(): Promise<void> {
  session?.stop();
  session = null;
  lockMap(map, false);
  await layoutForPlay(false);
  schedulePrefetch();
  showToast("Back to the map — zoom to a neighborhood, then press PLAY.");
}

fab.addEventListener("click", () => {
  void startPlay();
});

exitBtn?.addEventListener("click", () => {
  void exitGame();
});

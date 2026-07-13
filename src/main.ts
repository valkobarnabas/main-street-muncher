import "leaflet/dist/leaflet.css";
import "./style.css";
import { createMap, getViewBounds, lockMap } from "./map/mapApp";
import { searchPlace } from "./osm/nominatim";
import { prefetchStreets } from "./osm/overpass";
import { buildMaze } from "./maze/build";
import { startGame, type GameSession } from "./game/loop";
import { setHud, setPlayingUi, showToast } from "./ui/hud";

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
schedulePrefetch();

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
  starting = true;
  fab.disabled = true;
  showToast("Loading streets…");

  try {
    // Kick off street download immediately (often already cached from pan/zoom)
    const boundsBefore = getViewBounds(map);
    const mazePromise = buildMaze(boundsBefore);

    await layoutForPlay(true);
    setHud(0, 5, "Loading…");

    const result = await mazePromise;
    if (!result.ok) {
      showToast(result.reason);
      await layoutForPlay(false);
      return;
    }

    // Align map size after banner; maze was built for nearly the same view
    map.invalidateSize({ animate: false });

    const { maze, origin } = result;
    lockMap(map, true);
    setHud(0, 5, "Get ready…");
    showToast("Spot the chasers — then collect the dots!", 2800);

    session = startGame(map, maze, origin, canvas, {
      onScore: (score, lives, status) => setHud(score, lives, status),
      onEnd: (outcome) => {
        if (outcome === "won") {
          showToast("Level clear! Every dot is gone.");
        } else {
          showToast("Caught! Try another neighborhood.");
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
  showToast("Back to the map — pan or zoom, then play again.");
}

fab.addEventListener("click", () => {
  void startPlay();
});

exitBtn?.addEventListener("click", () => {
  void exitGame();
});

showToast("Search or pan to streets, then press Play.", 4000);

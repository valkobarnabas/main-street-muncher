import L from "leaflet";
import type { ViewBounds } from "../types";

export function createMap(container: HTMLElement): L.Map {
  const map = L.map(container, {
    zoomControl: true,
    attributionControl: true,
    zoomSnap: 0.25,
    zoomDelta: 0.25,
    wheelPxPerZoomLevel: 100,
  }).setView([40.758, -73.9855], 17); // Times Square, NYC

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  addFineZoomSlider(map);

  return map;
}

/** Vertical slider under +/- for fractional zoom without jumpiness. */
function addFineZoomSlider(map: L.Map): void {
  const FineZoom = L.Control.extend({
    onAdd() {
      const wrap = L.DomUtil.create("div", "leaflet-bar fine-zoom");
      const label = L.DomUtil.create("label", "fine-zoom-label", wrap);
      label.title = "Fine zoom";
      const input = L.DomUtil.create("input", "fine-zoom-slider", label) as HTMLInputElement;
      input.type = "range";
      input.min = String(map.getMinZoom());
      input.max = String(map.getMaxZoom());
      input.step = "0.25";
      input.value = String(map.getZoom());
      input.setAttribute("aria-label", "Fine zoom");

      const syncFromMap = () => {
        input.min = String(map.getMinZoom());
        input.max = String(map.getMaxZoom());
        input.value = String(map.getZoom());
      };
      map.on("zoomend zoomlevelschange", syncFromMap);

      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.on(input, "input", () => {
        map.setZoom(Number(input.value), { animate: false });
      });

      return wrap;
    },
  });

  new FineZoom({ position: "topleft" }).addTo(map);
}

/** Geographic bounds of the full visible map. */
export function getViewBounds(map: L.Map): ViewBounds {
  const b = map.getBounds();
  const north = b.getNorth();
  const south = b.getSouth();
  const east = b.getEast();
  const west = b.getWest();
  const midLat = (north + south) / 2;
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos((midLat * Math.PI) / 180);

  return {
    north,
    south,
    east,
    west,
    widthMeters: Math.abs(east - west) * metersPerDegLon,
    heightMeters: Math.abs(north - south) * metersPerDegLat,
  };
}

export function lockMap(map: L.Map, locked: boolean): void {
  if (locked) {
    map.dragging.disable();
    map.scrollWheelZoom.disable();
    map.doubleClickZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    map.touchZoom.disable();
  } else {
    map.dragging.enable();
    map.scrollWheelZoom.enable();
    map.doubleClickZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
    map.touchZoom.enable();
  }
}

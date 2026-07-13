import type { Chaser, LatLng, MazeGraph, EdgePose } from "../types";
import { unproject } from "../maze/geo";
import { poseWorld } from "./movement";
import type L from "leaflet";

const ROAD_OUTLINE = "#333366";
const ROAD_FILL = "#000000";
const DOT = "#80BC00";
const DOT_POWER = "#c5e86a";

export type RenderContext = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  map: L.Map;
  origin: LatLng;
};

export function resizeCanvas(canvas: HTMLCanvasElement): void {
  const stage = canvas.parentElement;
  const cssW = stage?.clientWidth || window.innerWidth;
  const cssH = stage?.clientHeight || window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function worldToScreen(
  map: L.Map,
  origin: LatLng,
  x: number,
  y: number,
): { sx: number; sy: number } {
  const ll = unproject({ x, y }, origin);
  const p = map.latLngToContainerPoint([ll.lat, ll.lon]);
  return { sx: p.x, sy: p.y };
}

function strokeAll(
  ctx: CanvasRenderingContext2D,
  paths: Array<Array<{ sx: number; sy: number }>>,
  color: string,
  width: number,
): void {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  for (const pts of paths) {
    if (pts.length < 2) continue;
    ctx.moveTo(pts[0]!.sx, pts[0]!.sy);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.sx, pts[i]!.sy);
  }
  ctx.stroke();
}

export function drawFrame(
  rc: RenderContext,
  maze: MazeGraph,
  player: EdgePose,
  chasers: Chaser[],
  pulse: number,
  frightenedFlash: boolean,
): void {
  const { canvas, ctx, map, origin } = rc;
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(0, 0, 8, 0.55)";
  ctx.fillRect(0, 0, w, h);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const paths = [...maze.edges.values()].map((e) =>
    e.points.map((p) => worldToScreen(map, origin, p.x, p.y)),
  );

  strokeAll(ctx, paths, ROAD_OUTLINE, 18);
  strokeAll(ctx, paths, ROAD_FILL, 12);

  for (const pellet of maze.pellets) {
    if (pellet.eaten) continue;
    const s = worldToScreen(map, origin, pellet.x, pellet.y);
    ctx.beginPath();
    ctx.fillStyle = pellet.power ? DOT_POWER : DOT;
    ctx.arc(s.sx, s.sy, pellet.power ? 7 : 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const pp = poseWorld(maze, player);
  const ps = worldToScreen(map, origin, pp.x, pp.y);
  const e = maze.edges.get(player.edgeId)!;
  const from = player.forward ? e.points[0]! : e.points[e.points.length - 1]!;
  const to = player.forward ? e.points[e.points.length - 1]! : e.points[0]!;
  const screenFrom = worldToScreen(map, origin, from.x, from.y);
  const screenTo = worldToScreen(map, origin, to.x, to.y);
  const facing = Math.atan2(screenTo.sy - screenFrom.sy, screenTo.sx - screenFrom.sx);
  drawIkarusBus(ctx, ps.sx, ps.sy, facing, 0.92 + pulse * 0.08);

  for (const g of chasers) {
    const gp = poseWorld(maze, g.pose);
    const gs = worldToScreen(map, origin, gp.x, gp.y);
    drawCone(ctx, gs.sx, gs.sy, g.state === "frightened", frightenedFlash);
  }
}

/** Simplified Ikarus 260 — boxy two-tone front, round lamps, BUDAPEST. */
function drawIkarusBus(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  scale: number,
): void {
  const s = 12 * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Body (front face facing +x)
  const w = s * 1.7;
  const h = s * 1.15;
  ctx.fillStyle = "#1a3a7a";
  ctx.fillRect(-w * 0.35, -h / 2, w, h);

  // Silver upper band
  ctx.fillStyle = "#c5ccd4";
  ctx.fillRect(-w * 0.35, -h / 2, w, h * 0.42);

  // Split windshield
  ctx.fillStyle = "#7ec8e8";
  ctx.fillRect(w * 0.25, -h * 0.42, w * 0.32, h * 0.34);
  ctx.strokeStyle = "#a8b0b8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.41, -h * 0.42);
  ctx.lineTo(w * 0.41, -h * 0.08);
  ctx.stroke();

  // Bumper
  ctx.fillStyle = "#b0b6bc";
  ctx.fillRect(w * 0.55, -h * 0.22, w * 0.12, h * 0.44);

  // Grille
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(w * 0.28, h * 0.05, w * 0.28, h * 0.22);
  ctx.strokeStyle = "#d0d4d8";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) {
    const gy = h * 0.08 + i * h * 0.07;
    ctx.beginPath();
    ctx.moveTo(w * 0.3, gy);
    ctx.lineTo(w * 0.54, gy);
    ctx.stroke();
  }

  // Round headlights
  ctx.fillStyle = "#fff8e0";
  ctx.beginPath();
  ctx.arc(w * 0.42, -h * 0.28, s * 0.14, 0, Math.PI * 2);
  ctx.arc(w * 0.42, h * 0.28, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Amber indicators
  ctx.fillStyle = "#f0a020";
  ctx.fillRect(w * 0.36, -h * 0.42, w * 0.12, h * 0.08);
  ctx.fillRect(w * 0.36, h * 0.34, w * 0.12, h * 0.08);

  // BUDAPEST label
  ctx.save();
  ctx.translate(w * 0.12, 0);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.max(5, s * 0.32)}px Space Grotesk, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("BUDAPEST", 0, 0);
  ctx.restore();

  ctx.strokeStyle = "#0a1528";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-w * 0.35, -h / 2, w, h);

  ctx.restore();
}

/** Traffic cone chaser. */
function drawCone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frightened: boolean,
  flash: boolean,
): void {
  const body = frightened ? (flash ? "#e8eefc" : "#3b5bdb") : "#f06020";
  const stripe = frightened ? "#a0a8c0" : "#ffffff";

  ctx.beginPath();
  ctx.moveTo(x, y - 11);
  ctx.lineTo(x + 8, y + 9);
  ctx.lineTo(x - 8, y + 9);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Base
  ctx.fillStyle = body;
  ctx.fillRect(x - 9, y + 7, 18, 4);

  // White stripes
  ctx.fillStyle = stripe;
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x + 4.5, y + 2);
  ctx.lineTo(x - 4.5, y + 2);
  ctx.closePath();
  ctx.fill();
}

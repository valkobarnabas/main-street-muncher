import type { GraphNode, PortalPair } from "../types";
import type { RawGraph } from "./graph";

type Cand = { id: number; node: GraphNode; along: number; side: string };

function opposite(side: string): string {
  if (side === "left") return "right";
  if (side === "right") return "left";
  if (side === "top") return "bottom";
  if (side === "bottom") return "top";
  return side;
}

function leafCandidates(g: RawGraph): Cand[] {
  const out: Cand[] = [];
  for (const node of g.nodes.values()) {
    if ((g.adj.get(node.id) ?? []).length !== 1) continue;
    const side = node.boundarySide ?? guessSide(node, g);
    const along = side === "left" || side === "right" ? node.y : node.x;
    out.push({ id: node.id, node, along, side });
  }
  return out;
}

function guessSide(node: GraphNode, g: RawGraph): string {
  // Use maze bounds from nodes extrema
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of g.nodes.values()) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }
  const dxL = Math.abs(node.x - minX);
  const dxR = Math.abs(node.x - maxX);
  const dyB = Math.abs(node.y - minY);
  const dyT = Math.abs(node.y - maxY);
  const m = Math.min(dxL, dxR, dyB, dyT);
  if (m === dxL) return "left";
  if (m === dxR) return "right";
  if (m === dyT) return "top";
  return "bottom";
}

/**
 * Every dead-end wraps to a re-entry on the far side.
 * Many exits may share the same entry (not exclusive pairs).
 */
export function buildPortals(g: RawGraph): PortalPair[] {
  const leaves = leafCandidates(g);
  if (leaves.length === 0) return [];

  const bySide = new Map<string, Cand[]>();
  for (const c of leaves) {
    const list = bySide.get(c.side) ?? [];
    list.push(c);
    bySide.set(c.side, list);
  }
  for (const list of bySide.values()) {
    list.sort((a, b) => a.along - b.along);
  }

  const pairs: PortalPair[] = [];
  for (const exit of leaves) {
    const opp = opposite(exit.side);
    let targets = bySide.get(opp) ?? [];
    // Prefer a different node; fall back to any other leaf
    if (targets.length === 0 || (targets.length === 1 && targets[0]!.id === exit.id)) {
      targets = leaves.filter((t) => t.id !== exit.id);
    }
    if (targets.length === 0) continue;

    let best = targets[0]!;
    let bestDist = Infinity;
    for (const t of targets) {
      if (t.id === exit.id) continue;
      const d = Math.abs(t.along - exit.along);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    if (best.id === exit.id) continue;
    pairs.push({
      id: `wrap-${exit.id}-${best.id}`,
      nodeA: exit.id,
      nodeB: best.id,
    });
  }
  return pairs;
}

/** One-way wrap: leaving nodeA re-enters at nodeB. */
export function portalPartner(
  portals: PortalPair[],
  nodeId: number,
): { partnerId: number; pair: PortalPair } | null {
  for (const p of portals) {
    if (p.nodeA === nodeId) return { partnerId: p.nodeB, pair: p };
  }
  return null;
}

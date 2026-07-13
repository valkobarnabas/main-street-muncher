export type Vec2 = { x: number; y: number };

export type LatLng = { lat: number; lon: number };

export type ViewBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
  /** Approximate width of the view in meters. */
  widthMeters: number;
  /** Approximate height of the view in meters. */
  heightMeters: number;
};

export type GraphNode = {
  id: number;
  x: number;
  y: number;
  /** On the view boundary (portal candidate). */
  onBoundary: boolean;
  boundarySide: BoundarySide | null;
};

export type BoundarySide = "left" | "right" | "top" | "bottom";

export type GraphEdge = {
  id: number;
  a: number;
  b: number;
  length: number;
  /** Sampled polyline in local meters (includes endpoints). */
  points: Vec2[];
};

/** Silent edge wrap — no visible matching labels. */
export type PortalPair = {
  id: string;
  nodeA: number;
  nodeB: number;
};

export type Pellet = {
  id: number;
  edgeId: number;
  t: number;
  x: number;
  y: number;
  power: boolean;
  eaten: boolean;
};

export type MazeGraph = {
  nodes: Map<number, GraphNode>;
  edges: Map<number, GraphEdge>;
  /** adjacency: nodeId -> edgeIds */
  adj: Map<number, number[]>;
  portals: PortalPair[];
  pellets: Pellet[];
  homeNodeId: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

/** Actor sitting on an undirected edge. */
export type EdgePose = {
  edgeId: number;
  /** 0 at node a, 1 at node b */
  t: number;
  /** true when traveling a -> b */
  forward: boolean;
};

export type DesiredDir = "up" | "down" | "left" | "right" | null;

export type ChaserRole = "rusher" | "sneaker" | "trickster" | "loafer";

export type ChaserState = "scatter" | "chase" | "frightened" | "eaten" | "gone";

export type Chaser = {
  role: ChaserRole;
  color: string;
  pose: EdgePose;
  state: ChaserState;
  scatterNodeId: number;
};

export type GamePhase = "browse" | "loading" | "playing" | "won" | "lost";

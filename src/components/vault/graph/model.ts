/**
 * Helpers puros del grafo (sin DOM ni React): fusión de datos conservando
 * posiciones, tamaños, tonos por carpeta, filtro, cámara y selección.
 */
import type { SimulationNodeDatum } from "d3-force";
import { foldText } from "@/features/vault/parse";
import type { GraphData } from "@/features/vault/types";

export type GraphNodeData = GraphData["nodes"][number];

export type GraphNode = SimulationNodeDatum & {
  id: string;
  name: string;
  folder: string;
  kind: string | null;
  degree: number;
  unresolved: boolean;
  tag: boolean;
  /** Enlaces dentro del grafo actual (el grado global puede ser mayor en el grafo local). */
  links: number;
  /** Nombre + ruta normalizados para el filtro. */
  search: string;
};

export type GraphLink = { source: GraphNode; target: GraphNode; index?: number };

export type GraphModel = {
  nodes: GraphNode[];
  links: GraphLink[];
  byId: Map<string, GraphNode>;
  neighbors: Map<GraphNode, Set<GraphNode>>;
  linkKeys: Set<string>;
  /** Hubo nodos o enlaces nuevos/eliminados respecto al modelo anterior. */
  changed: boolean;
  added: number;
};

export const MIN_ZOOM = 0.04;
export const MAX_ZOOM = 8;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function linkKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/** Nodo "es nota abrible" (no tag ni enlace sin resolver). */
export function isNote(node: Pick<GraphNode, "unresolved" | "tag">): boolean {
  return !node.unresolved && !node.tag;
}

/**
 * Convierte `GraphData` en el modelo de simulación reutilizando los objetos de
 * los nodos que ya existían: d3 conserva x/y/vx/vy y el layout no se reinicia
 * cuando cambia un archivo. Los nodos nuevos nacen junto a sus vecinos.
 */
export function mergeGraph(previous: GraphModel | null, data: GraphData, random: () => number = Math.random): GraphModel {
  const byId = new Map<string, GraphNode>();
  const nodes: GraphNode[] = [];
  let added = 0;

  for (const item of data.nodes) {
    if (byId.has(item.id)) continue;
    const existing = previous?.byId.get(item.id);
    const node: GraphNode = existing ?? {
      id: item.id,
      name: item.name,
      folder: item.folder,
      kind: item.kind,
      degree: item.degree,
      unresolved: item.unresolved,
      tag: Boolean(item.tag),
      links: 0,
      search: "",
    };
    if (!existing) added += 1;
    node.name = item.name;
    node.folder = item.folder;
    node.kind = item.kind;
    node.degree = item.degree;
    node.unresolved = item.unresolved;
    node.tag = Boolean(item.tag);
    node.links = 0;
    node.search = foldText(`${item.name}\n${item.id}`);
    byId.set(item.id, node);
    nodes.push(node);
  }

  const links: GraphLink[] = [];
  const linkKeys = new Set<string>();
  const neighbors = new Map<GraphNode, Set<GraphNode>>();
  for (const node of nodes) neighbors.set(node, new Set());
  for (const link of data.links) {
    const source = byId.get(link.source);
    const target = byId.get(link.target);
    if (!source || !target || source === target) continue;
    const key = linkKey(source.id, target.id);
    if (linkKeys.has(key)) continue;
    linkKeys.add(key);
    links.push({ source, target });
    source.links += 1;
    target.links += 1;
    neighbors.get(source)?.add(target);
    neighbors.get(target)?.add(source);
  }

  const removed = previous ? [...previous.byId.keys()].some((id) => !byId.has(id)) : false;
  let linksChanged = !previous || previous.linkKeys.size !== linkKeys.size;
  if (!linksChanged && previous) for (const key of linkKeys) if (!previous.linkKeys.has(key)) { linksChanged = true; break; }

  // Los nodos nuevos aparecen junto a sus vecinos ya colocados (o cerca del centro).
  const placed = previous ? previous.nodes.filter((node) => byId.has(node.id) && Number.isFinite(node.x) && Number.isFinite(node.y)) : [];
  if (placed.length) {
    let cx = 0;
    let cy = 0;
    for (const node of placed) {
      cx += node.x ?? 0;
      cy += node.y ?? 0;
    }
    cx /= placed.length;
    cy /= placed.length;
    for (const node of nodes) {
      if (Number.isFinite(node.x) && Number.isFinite(node.y)) continue;
      const anchors = [...(neighbors.get(node) ?? [])].filter((other) => Number.isFinite(other.x) && Number.isFinite(other.y));
      const jitter = () => (random() - 0.5) * 40;
      if (anchors.length) {
        node.x = anchors.reduce((sum, other) => sum + (other.x ?? 0), 0) / anchors.length + jitter();
        node.y = anchors.reduce((sum, other) => sum + (other.y ?? 0), 0) / anchors.length + jitter();
      } else {
        node.x = cx + jitter() * 4;
        node.y = cy + jitter() * 4;
      }
      node.vx = 0;
      node.vy = 0;
    }
  }

  return { nodes, links, byId, neighbors, linkKeys, changed: added > 0 || removed || linksChanged, added };
}

/**
 * Recorta el grafo a los nodos a `depth` saltos o menos de `root` (BFS por
 * niveles). Si `root` no está en los datos, los devuelve tal cual.
 */
export function neighborhood(data: GraphData, root: string, depth: number): GraphData {
  if (!data.nodes.some((node) => node.id === root)) return data;
  const adjacency = new Map<string, string[]>();
  const connect = (from: string, to: string) => {
    const list = adjacency.get(from);
    if (list) list.push(to);
    else adjacency.set(from, [to]);
  };
  for (const link of data.links) {
    connect(link.source, link.target);
    connect(link.target, link.source);
  }
  const keep = new Set([root]);
  let frontier = [root];
  for (let level = 0; level < depth && frontier.length; level += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const other of adjacency.get(id) ?? []) {
        if (keep.has(other)) continue;
        keep.add(other);
        next.push(other);
      }
    }
    frontier = next;
  }
  if (keep.size === data.nodes.length) return data;
  return {
    nodes: data.nodes.filter((node) => keep.has(node.id)),
    links: data.links.filter((link) => keep.has(link.source) && keep.has(link.target)),
  };
}

/** Radio en unidades de mundo. Igual que Obsidian: `max(8, min(3·√(peso+1), 30))`, escalado. */
export const NODE_SCALE = 0.5;
export function nodeRadius(degree: number, sizeMultiplier = 1): number {
  return sizeMultiplier * NODE_SCALE * Math.max(8, Math.min(3 * Math.sqrt(Math.max(0, degree) + 1), 30));
}

/**
 * Opacidad de las etiquetas según el zoom (el "umbral de desvanecimiento" de
 * Obsidian). `fade` va de -3 a 3: valores altos exigen más zoom para ver texto.
 */
export const LABEL_THRESHOLD = 1.25;
export function labelOpacity(zoom: number, fade = 0): number {
  const threshold = LABEL_THRESHOLD * 2 ** (fade / 2);
  const start = threshold * 0.72;
  const full = threshold * 1.3;
  return clamp(Math.log(zoom / start) / Math.log(full / start), 0, 1);
}

/** Opacidad base de los enlaces: más tenue cuanto más denso es el grafo. */
export function linkOpacity(count: number): number {
  return clamp(0.9 / Math.pow(Math.max(1, count), 0.25), 0.16, 0.4);
}

// ---------------------------------------------------------------------------
// Tonos por carpeta (solo grises: tono + forma)
// ---------------------------------------------------------------------------

export type NodeShape = "solid" | "halo" | "core";
export type NodeTone = { fill: string; shape: NodeShape };

/** Notas en la raíz y carpetas sin tono propio. */
export const DEFAULT_TONE: NodeTone = { fill: "#7c7c7c", shape: "solid" };
export const GROUP_TONES: readonly NodeTone[] = [
  { fill: "#b4b4b4", shape: "solid" },
  { fill: "#5c5c5c", shape: "solid" },
  { fill: "#dcdcdc", shape: "halo" },
  { fill: "#8a8a8a", shape: "halo" },
  { fill: "#dcdcdc", shape: "core" },
  { fill: "#8a8a8a", shape: "core" },
];

export type FolderGroup = { folder: string; count: number; tone: number };

/** Carpetas de primer nivel ordenadas por número de notas; las primeras reciben tono propio (-1 = tono por defecto). */
export function folderGroups(nodes: readonly Pick<GraphNodeData, "folder" | "unresolved" | "tag">[]): FolderGroup[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    if (node.unresolved || node.tag) continue;
    counts.set(node.folder, (counts.get(node.folder) ?? 0) + 1);
  }
  let next = 0;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .map(([folder, count]) => ({ folder, count, tone: folder && next < GROUP_TONES.length ? next++ : -1 }));
}

export function toneOf(index: number): NodeTone {
  return GROUP_TONES[index] ?? DEFAULT_TONE;
}

// ---------------------------------------------------------------------------
// Filtro
// ---------------------------------------------------------------------------

/** Términos del filtro (todos deben aparecer en nombre o ruta, sin acentos). */
export function filterTerms(query: string): string[] {
  return foldText(query.trim()).split(/\s+/).filter(Boolean);
}

export function matchesFilter(node: Pick<GraphNode, "search">, terms: readonly string[]): boolean {
  return terms.every((term) => node.search.includes(term));
}

// ---------------------------------------------------------------------------
// Cámara: pantalla = mundo · k + (x, y), en píxeles CSS
// ---------------------------------------------------------------------------

export type Camera = { x: number; y: number; k: number };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export function toWorld(camera: Camera, px: number, py: number): { x: number; y: number } {
  return { x: (px - camera.x) / camera.k, y: (py - camera.y) / camera.k };
}

export function zoomAt(camera: Camera, px: number, py: number, factor: number, min = MIN_ZOOM, max = MAX_ZOOM): Camera {
  const k = clamp(camera.k * factor, min, max);
  const ratio = k / camera.k;
  return { k, x: px - (px - camera.x) * ratio, y: py - (py - camera.y) * ratio };
}

export function boundsOf(nodes: readonly GraphNode[], radius: (node: GraphNode) => number): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const x = node.x;
    const y = node.y;
    if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    const r = radius(node);
    if (x - r < minX) minX = x - r;
    if (y - r < minY) minY = y - r;
    if (x + r > maxX) maxX = x + r;
    if (y + r > maxY) maxY = y + r;
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/** Cámara que encuadra `bounds` en un lienzo de `width × height` con `padding` px. */
export function fitCamera(bounds: Bounds, width: number, height: number, padding: number, maxZoom = 1.5): Camera {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1);
  const k = clamp(Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY), MIN_ZOOM, maxZoom);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return { k, x: width / 2 - cx * k, y: height / 2 - cy * k };
}

/** Interpola la cámara (zoom en escala logarítmica). Devuelve si ya llegó. */
export function easeCamera(from: Camera, to: Camera, amount: number): { camera: Camera; done: boolean } {
  const logK = Math.log(from.k) + (Math.log(to.k) - Math.log(from.k)) * amount;
  const camera = { k: Math.exp(logK), x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount };
  const done = Math.abs(Math.log(to.k / camera.k)) < 0.002 && Math.abs(to.x - camera.x) < 0.5 && Math.abs(to.y - camera.y) < 0.5;
  return { camera: done ? to : camera, done };
}

/**
 * Nodo bajo el punto (coordenadas de mundo). Gana el más cercano a su borde;
 * `slack` agranda el área sensible (útil con zoom lejano o dedos).
 */
export function pickNode(nodes: readonly GraphNode[], x: number, y: number, radius: (node: GraphNode) => number, slack: number): GraphNode | null {
  let best: GraphNode | null = null;
  let bestDistance = Infinity;
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (node.x === undefined || node.y === undefined) continue;
    const distance = Math.hypot(node.x - x, node.y - y) - radius(node);
    if (distance <= slack && distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }
  return best;
}

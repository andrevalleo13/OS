import { describe, expect, it } from "vitest";
import type { GraphData } from "@/features/vault/types";
import {
  DEFAULT_TONE,
  GROUP_TONES,
  boundsOf,
  easeCamera,
  filterTerms,
  fitCamera,
  folderGroups,
  labelOpacity,
  matchesFilter,
  mergeGraph,
  neighborhood,
  nodeRadius,
  pickNode,
  toneOf,
  toWorld,
  zoomAt,
  type GraphNode,
} from "./model";
import { configureSimulation, createSimulation, forceParams, settle } from "./simulation";

const node = (id: string, extra: Partial<GraphData["nodes"][number]> = {}): GraphData["nodes"][number] => ({
  id,
  name: id.replace(/\.md$/, "").split("/").pop() ?? id,
  folder: id.includes("/") ? id.split("/")[0] : "",
  kind: null,
  degree: 1,
  unresolved: false,
  ...extra,
});

const sample: GraphData = {
  nodes: [node("A/Uno.md"), node("A/Dos.md"), node("B/Tres.md"), node("?Fantasma", { unresolved: true, folder: "" }), node("#tag", { tag: true, folder: "" })],
  links: [
    { source: "A/Uno.md", target: "A/Dos.md" },
    { source: "A/Dos.md", target: "A/Uno.md" },
    { source: "A/Uno.md", target: "A/Uno.md" },
    { source: "A/Uno.md", target: "No/Existe.md" },
    { source: "B/Tres.md", target: "?Fantasma" },
    { source: "B/Tres.md", target: "#tag" },
  ],
};

describe("mergeGraph", () => {
  it("builds nodes, deduplicated links and neighbors", () => {
    const model = mergeGraph(null, sample);
    expect(model.nodes).toHaveLength(5);
    expect(model.links).toHaveLength(3);
    expect(model.changed).toBe(true);
    expect(model.added).toBe(5);
    const uno = model.byId.get("A/Uno.md")!;
    expect([...model.neighbors.get(uno)!].map((item) => item.id)).toEqual(["A/Dos.md"]);
    expect(uno.links).toBe(1);
    expect(model.byId.get("#tag")?.tag).toBe(true);
  });

  it("keeps node objects and positions across identical refetches", () => {
    const first = mergeGraph(null, sample);
    first.nodes.forEach((item, index) => {
      item.x = index * 10;
      item.y = -index * 10;
    });
    const second = mergeGraph(first, structuredClone(sample));
    expect(second.changed).toBe(false);
    expect(second.added).toBe(0);
    second.nodes.forEach((item, index) => {
      expect(item).toBe(first.nodes[index]);
      expect(item.x).toBe(index * 10);
      expect(item.y).toBe(-index * 10);
    });
  });

  it("places new nodes next to their placed neighbors", () => {
    const first = mergeGraph(null, sample);
    for (const item of first.nodes) {
      item.x = 1000;
      item.y = 1000;
    }
    const next: GraphData = {
      nodes: [...sample.nodes, node("C/Nueva.md")],
      links: [...sample.links, { source: "C/Nueva.md", target: "B/Tres.md" }],
    };
    const second = mergeGraph(first, next, () => 0.5);
    const fresh = second.byId.get("C/Nueva.md")!;
    expect(second.changed).toBe(true);
    expect(second.added).toBe(1);
    expect(fresh.x).toBe(1000);
    expect(fresh.y).toBe(1000);
  });

  it("flags removed nodes and changed links", () => {
    const first = mergeGraph(null, sample);
    const removed = mergeGraph(first, { nodes: sample.nodes.slice(0, 3), links: sample.links });
    expect(removed.changed).toBe(true);
    const relinked = mergeGraph(first, { nodes: sample.nodes, links: [{ source: "A/Uno.md", target: "B/Tres.md" }] });
    expect(relinked.changed).toBe(true);
  });
});

describe("neighborhood", () => {
  const chain: GraphData = {
    nodes: ["a", "b", "c", "d", "x"].map((id) => node(id)),
    links: [
      { source: "c", target: "d" },
      { source: "b", target: "c" },
      { source: "a", target: "b" },
    ],
  };

  it("keeps only nodes within the requested depth, regardless of link order", () => {
    expect(neighborhood(chain, "a", 1).nodes.map((item) => item.id)).toEqual(["a", "b"]);
    expect(neighborhood(chain, "a", 2).nodes.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(neighborhood(chain, "a", 2).links).toHaveLength(2);
    expect(neighborhood(chain, "c", 1).nodes.map((item) => item.id)).toEqual(["b", "c", "d"]);
  });

  it("returns the data untouched when the root is missing", () => {
    expect(neighborhood(chain, "nope", 1)).toBe(chain);
  });
});

describe("tamaños y texto", () => {
  it("scales node radius with sqrt(degree) within Obsidian's bounds", () => {
    expect(nodeRadius(0)).toBe(4);
    expect(nodeRadius(20)).toBeGreaterThan(nodeRadius(10));
    expect(nodeRadius(10_000)).toBe(15);
    expect(nodeRadius(10_000, 2)).toBe(30);
  });

  it("fades labels in with zoom and respects the threshold", () => {
    expect(labelOpacity(0.3)).toBe(0);
    expect(labelOpacity(4)).toBe(1);
    expect(labelOpacity(1.2)).toBeGreaterThan(labelOpacity(1));
    expect(labelOpacity(1.2, 2)).toBeLessThan(labelOpacity(1.2, 0));
    expect(labelOpacity(1.2, -2)).toBeGreaterThan(labelOpacity(1.2, 0));
  });
});

describe("folderGroups", () => {
  it("ranks folders by size, keeps root on the default tone and ignores tags/unresolved", () => {
    const nodes = [
      ...Array.from({ length: 3 }, (_, index) => node(`Grande/${index}.md`)),
      ...Array.from({ length: 2 }, (_, index) => node(`Media/${index}.md`)),
      node("Raiz.md"),
      node("?x", { unresolved: true, folder: "" }),
      node("#t", { tag: true, folder: "" }),
    ];
    const groups = folderGroups(nodes);
    expect(groups.map((group) => [group.folder, group.count, group.tone])).toEqual([
      ["Grande", 3, 0],
      ["Media", 2, 1],
      ["", 1, -1],
    ]);
    expect(toneOf(-1)).toBe(DEFAULT_TONE);
  });

  it("falls back to the default tone when folders outnumber the tones", () => {
    const nodes = Array.from({ length: GROUP_TONES.length + 2 }, (_, index) => node(`F${String(index).padStart(2, "0")}/n.md`));
    const groups = folderGroups(nodes);
    expect(groups.filter((group) => group.tone === -1)).toHaveLength(2);
  });

  it("only uses greys", () => {
    for (const tone of [DEFAULT_TONE, ...GROUP_TONES]) {
      const [r, g, b] = [1, 3, 5].map((offset) => tone.fill.slice(offset, offset + 2));
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });
});

describe("filtro", () => {
  it("matches every term against name and path, ignoring accents and case", () => {
    const model = mergeGraph(null, { nodes: [node("200 - Áreas/Psicología y Drivers.md")], links: [] });
    const target = model.nodes[0];
    expect(matchesFilter(target, filterTerms("psicologia"))).toBe(true);
    expect(matchesFilter(target, filterTerms("AREAS drivers"))).toBe(true);
    expect(matchesFilter(target, filterTerms("drivers finanzas"))).toBe(false);
    expect(filterTerms("   ")).toEqual([]);
  });
});

describe("cámara", () => {
  it("zooms around the cursor keeping the world point fixed", () => {
    const camera = { x: 100, y: 50, k: 1 };
    const before = toWorld(camera, 300, 200);
    const zoomed = zoomAt(camera, 300, 200, 2);
    const after = toWorld(zoomed, 300, 200);
    expect(zoomed.k).toBe(2);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(zoomAt(camera, 0, 0, 1e6).k).toBeLessThanOrEqual(8);
  });

  it("fits bounds in the middle of the canvas", () => {
    const camera = fitCamera({ minX: -100, minY: -50, maxX: 100, maxY: 50 }, 400, 400, 0, 10);
    expect(camera.k).toBe(2);
    expect(camera.x).toBe(200);
    expect(camera.y).toBe(200);
    expect(fitCamera({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, 400, 400, 0, 1.5).k).toBe(1.5);
  });

  it("eases towards the target and reports when it arrives", () => {
    const target = { x: 10, y: 10, k: 2 };
    let state = { camera: { x: 0, y: 0, k: 1 }, done: false };
    for (let index = 0; index < 200 && !state.done; index += 1) state = easeCamera(state.camera, target, 0.2);
    expect(state.done).toBe(true);
    expect(state.camera).toEqual(target);
  });

  it("picks the closest node within the slack", () => {
    const nodes = [{ id: "a", x: 0, y: 0 }, { id: "b", x: 20, y: 0 }] as GraphNode[];
    const radius = () => 5;
    expect(pickNode(nodes, 1, 1, radius, 0)?.id).toBe("a");
    expect(pickNode(nodes, 17, 0, radius, 0)?.id).toBe("b");
    expect(pickNode(nodes, 10, 30, radius, 2)).toBeNull();
    expect(boundsOf(nodes, radius)).toEqual({ minX: -5, minY: -5, maxX: 25, maxY: 5 });
  });
});

describe("simulación", () => {
  it("maps Obsidian's force settings to d3", () => {
    const params = forceParams({ centerStrength: 0.5, repelStrength: 10, linkStrength: 1, linkDistance: 250 });
    expect(params.charge).toBeLessThan(0);
    expect(params.linkDistance).toBeGreaterThan(0);
    expect(params.center).toBeGreaterThan(0);
  });

  it("settles a small graph to finite, spread-out positions", () => {
    const model = mergeGraph(null, sample);
    const simulation = createSimulation();
    configureSimulation(simulation, model.nodes, model.links, { centerStrength: 0.52, repelStrength: 10, linkStrength: 1, linkDistance: 250 }, 1);
    simulation.alpha(1);
    const ticks = settle(simulation);
    expect(ticks).toBeGreaterThan(0);
    expect(simulation.alpha()).toBeLessThan(simulation.alphaMin());
    for (const item of model.nodes) {
      expect(Number.isFinite(item.x)).toBe(true);
      expect(Number.isFinite(item.y)).toBe(true);
    }
    const [a, b] = [model.byId.get("A/Uno.md")!, model.byId.get("A/Dos.md")!];
    expect(Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0))).toBeGreaterThan(nodeRadius(1) * 2);
  });
});

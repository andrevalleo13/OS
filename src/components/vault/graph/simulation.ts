/**
 * Simulación d3-force con los parámetros de Obsidian traducidos a unidades de
 * mundo. Nunca usa el temporizador interno de d3: el motor avanza con `tick()`
 * dentro de su único requestAnimationFrame.
 */
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type ForceLink,
  type Simulation,
} from "d3-force";
import { nodeRadius, type GraphLink, type GraphNode } from "./model";

export type ForceSettings = {
  /** Obsidian: 0–1 (0.52 por defecto). */
  centerStrength: number;
  /** Obsidian: 0–20 (10 por defecto). */
  repelStrength: number;
  /** Obsidian: 0–1 (1 por defecto). */
  linkStrength: number;
  /** Obsidian: 30–500 (250 por defecto). */
  linkDistance: number;
};

/** Conversión de las unidades de Obsidian a la escala de este mundo. */
export const FORCE_SCALE = { center: 0.12, charge: 14, distance: 0.2 } as const;

export function forceParams(settings: ForceSettings) {
  return {
    center: settings.centerStrength * FORCE_SCALE.center,
    charge: -settings.repelStrength * FORCE_SCALE.charge,
    linkStrength: settings.linkStrength,
    linkDistance: settings.linkDistance * FORCE_SCALE.distance,
  };
}

export type GraphSimulation = Simulation<GraphNode, GraphLink>;

export function createSimulation(): GraphSimulation {
  // forceSimulation arranca un temporizador propio: se detiene en el acto.
  return forceSimulation<GraphNode, GraphLink>()
    .stop()
    .alphaDecay(0.0228)
    .velocityDecay(0.4)
    .force("link", forceLink<GraphNode, GraphLink>())
    .force("charge", forceManyBody<GraphNode>().theta(0.9).distanceMax(520))
    .force("center", forceCenter<GraphNode>(0, 0))
    .force("x", forceX<GraphNode>(0))
    .force("y", forceY<GraphNode>(0))
    .force("collide", forceCollide<GraphNode>().iterations(1).strength(0.7));
}

/** Carga nodos/enlaces y aplica las fuerzas. Re-inicializa los radios de colisión. */
export function configureSimulation(simulation: GraphSimulation, nodes: GraphNode[], links: GraphLink[], forces: ForceSettings, sizeMultiplier: number) {
  const params = forceParams(forces);
  simulation.nodes(nodes);
  const link = simulation.force("link") as ForceLink<GraphNode, GraphLink> | undefined;
  link
    ?.links(links)
    .distance(params.linkDistance)
    .strength((item) => params.linkStrength / Math.max(1, Math.min(item.source.links, item.target.links)));
  (simulation.force("charge") as ReturnType<typeof forceManyBody<GraphNode>> | undefined)?.strength(params.charge);
  (simulation.force("x") as ReturnType<typeof forceX<GraphNode>> | undefined)?.strength(params.center);
  (simulation.force("y") as ReturnType<typeof forceY<GraphNode>> | undefined)?.strength(params.center);
  (simulation.force("collide") as ReturnType<typeof forceCollide<GraphNode>> | undefined)?.radius((node) => nodeRadius(node.degree, sizeMultiplier) + 2);
}

export function isRunning(simulation: GraphSimulation): boolean {
  return simulation.alpha() >= simulation.alphaMin() || simulation.alphaTarget() > 0;
}

/** Ejecuta la simulación hasta enfriarse, sin animar (prefers-reduced-motion). */
export function settle(simulation: GraphSimulation, maxTicks = 320) {
  let ticks = 0;
  while (simulation.alpha() >= simulation.alphaMin() && ticks < maxTicks) {
    simulation.tick();
    ticks += 1;
  }
  return ticks;
}

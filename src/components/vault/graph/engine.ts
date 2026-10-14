/**
 * Motor imperativo del grafo: canvas HiDPI, simulación d3-force, cámara,
 * puntero/rueda/pinza y un único bucle requestAnimationFrame que se detiene
 * cuando no hay nada que animar. React solo le pasa datos y ajustes.
 */
import type { GraphData } from "@/features/vault/types";
import {
  boundsOf,
  clamp,
  easeCamera,
  filterTerms,
  fitCamera,
  folderGroups,
  isNote,
  labelOpacity,
  linkOpacity,
  matchesFilter,
  mergeGraph,
  nodeRadius,
  pickNode,
  toneOf,
  toWorld,
  zoomAt,
  type Camera,
  type GraphModel,
  type GraphNode,
} from "./model";
import { configureSimulation, createSimulation, isRunning, settle, type ForceSettings } from "./simulation";

const TAU = Math.PI * 2;

/** Debe coincidir con el fondo del contenedor: tapa los enlaces bajo los nodos huecos. */
export const GRAPH_BACKGROUND = "#0a0a0a";
const LINK_STROKE = "#eeeeee";
const HIGHLIGHT = "#ffffff";
const UNRESOLVED_STROKE = "#767676";
const TAG_FILL = "#bdbdbd";
const CORE_FILL = "#1c1c1c";
const LABEL_FILL = "#dedede";
const LABEL_MUTED = "#9a9a9a";
const LABEL_HALO = "rgba(10,10,10,0.82)";

export type GraphDisplaySettings = { nodeSize: number; linkWidth: number; textFade: number };
export type GraphEngineSettings = ForceSettings & GraphDisplaySettings;

export type GraphEngineCallbacks = {
  onOpen: (path: string, options: { newTab: boolean }) => void;
};

type Point = { x: number; y: number };
type Press = { pointerId: number; touch: boolean; middle: boolean; start: Point; last: Point; node: GraphNode | null; moved: boolean };

const FORCE_KEYS = ["centerStrength", "repelStrength", "linkStrength", "linkDistance"] as const;

function truncate(text: string, max = 48): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export class GraphEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly simulation = createSimulation();
  private readonly resizeObserver: ResizeObserver;
  private readonly motionQuery: MediaQueryList | null;
  private dprQuery: MediaQueryList | null = null;

  private model: GraphModel | null = null;
  private drawOrder: GraphNode[] = [];
  private tones = new Map<string, number>();
  private settings: GraphEngineSettings;
  private local: boolean;

  private camera: Camera = { x: 0, y: 0, k: 1 };
  /** Mientras sea true, la cámara sigue encuadrando el grafo (hasta que el usuario hace zoom o arrastra). */
  private follow = true;
  private width = 0;
  private height = 0;
  private dpr = 1;

  private hovered: GraphNode | null = null;
  private focus: GraphNode | null = null;
  private focusT = 0;
  private activeId: string | null = null;
  private matches: Set<GraphNode> | null = null;
  private terms: string[] = [];

  private pointers = new Map<number, Point>();
  private press: Press | null = null;
  private dragging: GraphNode | null = null;
  private panning = false;
  private pinch: { distance: number; mid: Point } | null = null;

  private raf = 0;
  private lastTime = 0;
  private destroyed = false;
  private fontFamily = "sans-serif";

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: GraphEngineCallbacks,
    options: { local: boolean; settings: GraphEngineSettings },
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible.");
    this.ctx = ctx;
    this.local = options.local;
    this.settings = options.settings;
    this.fontFamily = getComputedStyle(canvas).fontFamily || "sans-serif";
    this.motionQuery = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("dblclick", this.onDoubleClick);
    this.motionQuery?.addEventListener("change", this.onMotionChange);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.watchPixelRatio();
    this.resize();
    // Las etiquetas usan la fuente de la página: repinta cuando termine de cargar.
    void document.fonts?.ready.then(() => this.requestFrame());
  }

  // -------------------------------------------------------------------------
  // API pública
  // -------------------------------------------------------------------------

  setData(data: GraphData) {
    const first = !this.model || this.model.nodes.length === 0;
    const model = mergeGraph(this.model, data);
    this.model = model;
    this.tones = new Map(folderGroups(model.nodes).map((group) => [group.folder, group.tone]));
    const rank = (node: GraphNode) => (node.tag ? 0 : node.unresolved ? 1 : 2);
    this.drawOrder = [...model.nodes].sort((a, b) => rank(a) - rank(b) || a.degree - b.degree);

    configureSimulation(this.simulation, model.nodes, model.links, this.settings, this.settings.nodeSize);
    for (const key of ["hovered", "focus", "dragging"] as const) {
      const node = this[key];
      if (node && model.byId.get(node.id) !== node) this[key] = null;
    }
    if (!this.focus) this.focusT = 0;
    this.applyFilter();

    if (model.changed) {
      if (first) {
        this.follow = true;
        this.simulation.alpha(1);
      } else {
        this.simulation.alpha(Math.max(this.simulation.alpha(), model.added ? 0.5 : 0.3));
      }
    }
    this.requestFrame();
  }

  setSettings(next: GraphEngineSettings) {
    const previous = this.settings;
    this.settings = next;
    const forcesChanged = FORCE_KEYS.some((key) => previous[key] !== next[key]);
    const sizeChanged = previous.nodeSize !== next.nodeSize;
    if (this.model && (forcesChanged || sizeChanged)) {
      configureSimulation(this.simulation, this.model.nodes, this.model.links, next, next.nodeSize);
      this.simulation.alpha(Math.max(this.simulation.alpha(), forcesChanged ? 0.3 : 0.12));
    }
    this.requestFrame();
  }

  setLocal(local: boolean) {
    if (this.local === local) return;
    this.local = local;
    this.follow = true;
    this.requestFrame();
  }

  setActive(id: string | null) {
    if (this.activeId === id) return;
    this.activeId = id;
    if (this.local) this.follow = true;
    this.requestFrame();
  }

  setFilter(query: string) {
    this.terms = filterTerms(query);
    this.applyFilter();
    this.requestFrame();
  }

  /** "Reanimar": recoloca los nodos y vuelve a correr la simulación desde cero. */
  reheat() {
    if (!this.model) return;
    for (const node of this.model.nodes) {
      node.x = undefined;
      node.y = undefined;
      node.vx = undefined;
      node.vy = undefined;
      node.fx = null;
      node.fy = null;
    }
    configureSimulation(this.simulation, this.model.nodes, this.model.links, this.settings, this.settings.nodeSize);
    this.simulation.alpha(1);
    this.follow = true;
    this.requestFrame();
  }

  /** "Centrar": encuadra el grafo y lo sigue mientras se acomoda. */
  center() {
    this.follow = true;
    this.requestFrame();
  }

  zoomBy(factor: number) {
    this.follow = false;
    this.camera = zoomAt(this.camera, this.width / 2, this.height / 2, factor);
    this.requestFrame();
  }

  destroy() {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.simulation.stop();
    this.resizeObserver.disconnect();
    this.dprQuery?.removeEventListener("change", this.onPixelRatioChange);
    this.motionQuery?.removeEventListener("change", this.onMotionChange);
    const canvas = this.canvas;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerCancel);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("wheel", this.onWheel);
    canvas.removeEventListener("dblclick", this.onDoubleClick);
    this.model = null;
    this.drawOrder = [];
  }

  // -------------------------------------------------------------------------
  // Estado interno
  // -------------------------------------------------------------------------

  private get reduced(): boolean {
    return this.motionQuery?.matches === true || document.documentElement.dataset.reducedMotion === "true";
  }

  private applyFilter() {
    const model = this.model;
    this.matches = model && this.terms.length ? new Set(model.nodes.filter((node) => matchesFilter(node, this.terms))) : null;
  }

  private radiusOf = (node: GraphNode) => nodeRadius(node.degree, this.settings.nodeSize);

  private fitTarget(): Camera | null {
    if (!this.model || !this.width || !this.height) return null;
    const bounds = boundsOf(this.model.nodes, this.radiusOf);
    if (!bounds) return null;
    const padding = this.local ? Math.min(28, Math.min(this.width, this.height) * 0.1) : 40;
    // Margen inferior extra para la etiqueta de los nodos del borde.
    bounds.maxY += this.local ? 10 : 0;
    return fitCamera(bounds, this.width, this.height, padding, this.local ? 1.5 : 1.2);
  }

  private snapToFit() {
    const target = this.fitTarget();
    if (target) this.camera = target;
  }

  private requestFrame() {
    if (this.raf || this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (time: number) => {
    this.raf = 0;
    if (this.destroyed) return;
    const dt = this.lastTime ? Math.min(64, time - this.lastTime) : 16;
    this.lastTime = time;
    const reduced = this.reduced;
    let busy = false;

    if (this.model && isRunning(this.simulation)) {
      // Movimiento reducido: la simulación se resuelve de golpe y se pinta una vez.
      if (reduced && !this.dragging) settle(this.simulation);
      else this.simulation.tick();
      busy = isRunning(this.simulation);
    }

    // Fundido del resaltado al pasar el puntero.
    if (this.hovered) this.focus = this.hovered;
    const target = this.hovered ? 1 : 0;
    if (this.focusT !== target) {
      const step = reduced ? 1 : dt / 140;
      this.focusT = target > this.focusT ? Math.min(target, this.focusT + step) : Math.max(target, this.focusT - step);
      busy = busy || this.focusT !== target;
    }
    if (!this.hovered && this.focusT === 0) this.focus = null;

    if (this.follow && !this.dragging) {
      const fit = this.fitTarget();
      if (fit) {
        if (reduced) this.camera = fit;
        else {
          const eased = easeCamera(this.camera, fit, 1 - Math.exp(-dt / 90));
          this.camera = eased.camera;
          busy = busy || !eased.done;
        }
      }
    }

    this.draw();
    if (busy || this.dragging) this.requestFrame();
    else this.lastTime = 0;
  };

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private draw() {
    const { ctx, canvas, dpr, camera, model } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!model || !this.width || !this.height) return;

    const k = camera.k;
    const focus = this.focus;
    const t = this.focusT * this.focusT * (3 - 2 * this.focusT);
    const neighborhood = focus ? model.neighbors.get(focus) ?? null : null;
    const matches = this.matches;
    const view = {
      minX: -camera.x / k,
      minY: -camera.y / k,
      maxX: (this.width - camera.x) / k,
      maxY: (this.height - camera.y) / k,
    };
    const visible = (node: GraphNode, margin: number) =>
      node.x !== undefined && node.y !== undefined &&
      node.x + margin >= view.minX && node.x - margin <= view.maxX && node.y + margin >= view.minY && node.y - margin <= view.maxY;

    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * camera.x, dpr * camera.y);

    // Enlaces: hasta tres trazos por lotes (normal, resaltado y atenuado).
    const base = linkOpacity(model.links.length);
    ctx.lineWidth = (this.settings.linkWidth * clamp(Math.sqrt(k), 0.55, 1.6)) / k;
    ctx.strokeStyle = LINK_STROKE;
    ctx.lineCap = "round";
    if (!focus && !matches) {
      ctx.beginPath();
      for (const link of model.links) {
        ctx.moveTo(link.source.x ?? 0, link.source.y ?? 0);
        ctx.lineTo(link.target.x ?? 0, link.target.y ?? 0);
      }
      ctx.globalAlpha = base;
      ctx.stroke();
    } else {
      const hot = new Path2D();
      const cold = new Path2D();
      const dim = new Path2D();
      for (const link of model.links) {
        const path = focus && (link.source === focus || link.target === focus)
          ? hot
          : matches && !(matches.has(link.source) && matches.has(link.target)) ? dim : cold;
        path.moveTo(link.source.x ?? 0, link.source.y ?? 0);
        path.lineTo(link.target.x ?? 0, link.target.y ?? 0);
      }
      const fade = 1 - 0.78 * t;
      ctx.globalAlpha = base * 0.22 * fade;
      ctx.stroke(dim);
      ctx.globalAlpha = base * fade;
      ctx.stroke(cold);
      ctx.globalAlpha = base + (0.7 - base) * t;
      ctx.stroke(hot);
    }

    // Nodos.
    const alphaOf = (node: GraphNode) => {
      let alpha = matches && !matches.has(node) ? 0.14 : 1;
      if (focus && node !== focus && !neighborhood?.has(node)) alpha *= 1 - 0.84 * t;
      return alpha;
    };
    const minRadius = 1.4 / k;
    let active: GraphNode | null = null;
    for (const node of this.drawOrder) {
      if (node.id === this.activeId) {
        active = node;
        continue;
      }
      if (node === focus) continue;
      const r = Math.max(this.radiusOf(node), minRadius);
      if (!visible(node, r * 1.5)) continue;
      this.drawNode(node, r, alphaOf(node), false);
    }
    if (active) {
      const r = Math.max(this.radiusOf(active), minRadius);
      const alpha = alphaOf(active);
      if (active !== focus) this.drawNode(active, r, alpha, true);
      ctx.globalAlpha = Math.max(alpha, 0.35);
      ctx.beginPath();
      ctx.arc(active.x ?? 0, active.y ?? 0, r * 1.12 + 3.5 / k, 0, TAU);
      ctx.lineWidth = 1.25 / k;
      ctx.strokeStyle = HIGHLIGHT;
      ctx.stroke();
    }
    if (focus) {
      // Tono propio + blanco encima según el fundido: transición suave al entrar/salir.
      const r = Math.max(this.radiusOf(focus), minRadius);
      const alpha = Math.max(alphaOf(focus), t);
      if (focus.id === this.activeId) this.drawNode(focus, r, alpha, true);
      else {
        this.drawNode(focus, r, alpha, false);
        this.drawNode(focus, r, alpha * t, true);
      }
    }

    // Etiquetas en espacio de pantalla (nítidas a cualquier zoom).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const zoomAlpha = labelOpacity(k, this.settings.textFade);
    const fontSize = clamp(10.5 * Math.pow(k, 0.3), 9, 13);
    ctx.font = `${fontSize.toFixed(1)}px ${this.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = LABEL_HALO;
    const showNeighborLabels = Boolean(neighborhood && neighborhood.size <= 40);
    // Con pocas coincidencias, el filtro nombra los nodos que encuentra.
    const showMatchLabels = Boolean(matches && matches.size <= 40);
    const label = (node: GraphNode) => {
      let alpha = zoomAlpha;
      if (node === focus) alpha = Math.max(alpha, t);
      else if (showNeighborLabels && neighborhood?.has(node)) alpha = Math.max(alpha, 0.75 * t);
      if (showMatchLabels && matches?.has(node)) alpha = Math.max(alpha, 0.85);
      if (node.id === this.activeId) alpha = Math.max(alpha, 0.9);
      alpha *= alphaOf(node);
      if (alpha < 0.02) return;
      const r = Math.max(this.radiusOf(node), minRadius);
      if (!visible(node, r + 200 / k)) return;
      const x = (node.x ?? 0) * k + camera.x;
      const y = (node.y ?? 0) * k + camera.y + r * k + 3;
      const text = truncate(node.name);
      ctx.globalAlpha = alpha;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = node === focus ? HIGHLIGHT : isNote(node) ? LABEL_FILL : LABEL_MUTED;
      ctx.fillText(text, x, y);
    };
    for (const node of this.drawOrder) if (node !== focus && node !== active) label(node);
    if (active && active !== focus) label(active);
    if (focus) label(focus);
    ctx.globalAlpha = 1;
  }

  private drawNode(node: GraphNode, r: number, alpha: number, emphasis: boolean) {
    const ctx = this.ctx;
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    ctx.globalAlpha = alpha;
    if (node.tag) {
      const half = r * 0.78;
      ctx.fillStyle = emphasis ? HIGHLIGHT : TAG_FILL;
      ctx.fillRect(x - half, y - half, half * 2, half * 2);
      return;
    }
    if (node.unresolved) {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.86, 0, TAU);
      ctx.fillStyle = GRAPH_BACKGROUND;
      ctx.fill();
      ctx.lineWidth = Math.max(r * 0.22, 1 / this.camera.k);
      ctx.strokeStyle = emphasis ? HIGHLIGHT : UNRESOLVED_STROKE;
      ctx.stroke();
      return;
    }
    const tone = toneOf(this.tones.get(node.folder) ?? -1);
    const fill = emphasis ? HIGHLIGHT : tone.fill;
    if (tone.shape === "core") {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.88, 0, TAU);
      ctx.fillStyle = CORE_FILL;
      ctx.fill();
      ctx.lineWidth = r * 0.24;
      ctx.strokeStyle = fill;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.4, 0, TAU);
      ctx.fillStyle = fill;
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
    if (tone.shape === "halo") {
      ctx.beginPath();
      ctx.arc(x, y, r * 1.45, 0, TAU);
      ctx.lineWidth = r * 0.14;
      ctx.strokeStyle = fill;
      ctx.globalAlpha = alpha * 0.7;
      ctx.stroke();
    }
  }

  // -------------------------------------------------------------------------
  // Tamaño y densidad de píxeles
  // -------------------------------------------------------------------------

  private resize() {
    if (this.destroyed) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (!this.follow && this.width && this.height) {
      this.camera = { ...this.camera, x: this.camera.x + (width - this.width) / 2, y: this.camera.y + (height - this.height) / 2 };
    }
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    if (this.follow) this.snapToFit();
    // Cambiar el tamaño borra el lienzo: se repinta en el acto para no parpadear.
    this.draw();
  }

  private watchPixelRatio() {
    this.dprQuery?.removeEventListener("change", this.onPixelRatioChange);
    if (typeof window.matchMedia !== "function") return;
    this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this.dprQuery.addEventListener("change", this.onPixelRatioChange);
  }

  private onPixelRatioChange = () => {
    this.watchPixelRatio();
    this.resize();
  };

  private onMotionChange = () => this.requestFrame();

  // -------------------------------------------------------------------------
  // Puntero
  // -------------------------------------------------------------------------

  private point(event: PointerEvent | WheelEvent | MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private pickAt(point: Point, touch: boolean): GraphNode | null {
    if (!this.model) return null;
    const world = toWorld(this.camera, point.x, point.y);
    const minRadius = 1.4 / this.camera.k;
    return pickNode(this.drawOrder, world.x, world.y, (node) => Math.max(this.radiusOf(node), minRadius), (touch ? 12 : 4) / this.camera.k);
  }

  private setHovered(node: GraphNode | null) {
    if (this.hovered === node) return;
    this.hovered = node;
    this.updateCursor();
    this.requestFrame();
  }

  private updateCursor() {
    const cursor = this.dragging || this.panning ? "grabbing" : this.hovered && isNote(this.hovered) ? "pointer" : "default";
    if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;
  }

  private releaseDrag() {
    const node = this.dragging;
    if (!node) return;
    node.fx = null;
    node.fy = null;
    this.dragging = null;
    this.simulation.alphaTarget(0);
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 1) return;
    if (event.button === 1) event.preventDefault();
    const point = this.point(event);
    this.pointers.set(event.pointerId, point);
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      // el puntero ya no existe
    }

    if (this.pointers.size === 2) {
      // Segundo dedo: pasa a pellizco y cancela arrastres.
      this.releaseDrag();
      this.press = null;
      this.panning = false;
      const [a, b] = [...this.pointers.values()];
      this.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      this.updateCursor();
      return;
    }
    if (this.pointers.size > 2) return;

    const touch = event.pointerType !== "mouse";
    this.press = { pointerId: event.pointerId, touch, middle: event.button === 1, start: point, last: point, node: this.pickAt(point, touch), moved: false };
  };

  private onPointerMove = (event: PointerEvent) => {
    const point = this.point(event);
    if (this.pointers.has(event.pointerId)) this.pointers.set(event.pointerId, point);

    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const zoomed = zoomAt(this.camera, mid.x, mid.y, distance / this.pinch.distance);
      this.camera = { k: zoomed.k, x: zoomed.x + mid.x - this.pinch.mid.x, y: zoomed.y + mid.y - this.pinch.mid.y };
      this.pinch = { distance, mid };
      this.follow = false;
      this.requestFrame();
      return;
    }

    const press = this.press;
    if (press && press.pointerId === event.pointerId) {
      if (!press.moved && !press.middle && Math.hypot(point.x - press.start.x, point.y - press.start.y) > (press.touch ? 6 : 3)) {
        press.moved = true;
        if (press.node) {
          this.dragging = press.node;
          press.node.fx = press.node.x;
          press.node.fy = press.node.y;
          this.simulation.alphaTarget(0.3);
          this.hovered = press.node;
        } else {
          this.panning = true;
          this.follow = false;
        }
        this.updateCursor();
      }
      if (press.moved) {
        if (this.dragging) {
          const world = toWorld(this.camera, point.x, point.y);
          this.dragging.fx = world.x;
          this.dragging.fy = world.y;
        } else if (this.panning) {
          this.camera = { ...this.camera, x: this.camera.x + point.x - press.last.x, y: this.camera.y + point.y - press.last.y };
        }
        press.last = point;
        this.requestFrame();
      }
      return;
    }

    if (event.pointerType === "mouse" && !this.pointers.size) this.setHovered(this.pickAt(point, false));
  };

  private endPointer(event: PointerEvent, cancelled: boolean) {
    this.pointers.delete(event.pointerId);
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null;
      this.press = null;
      return;
    }
    const press = this.press;
    if (!press || press.pointerId !== event.pointerId) return;
    this.press = null;

    if (this.dragging) {
      this.releaseDrag();
      if (press.touch) this.hovered = null;
    } else if (!press.moved && !cancelled) {
      const node = press.node;
      if (node && isNote(node)) {
        this.callbacks.onOpen(node.id, { newTab: press.middle || event.metaKey || event.ctrlKey });
      } else if (press.touch) {
        // En táctil no hay hover: tocar un tag o un enlace sin resolver muestra su nombre.
        this.hovered = node;
      }
    }
    this.panning = false;
    this.updateCursor();
    this.requestFrame();
  }

  private onPointerUp = (event: PointerEvent) => this.endPointer(event, false);
  private onPointerCancel = (event: PointerEvent) => this.endPointer(event, true);

  private onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && !this.press && !this.dragging) this.setHovered(null);
  };

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1;
    const delta = clamp(event.deltaY * unit, -400, 400);
    // ctrlKey = pellizco del trackpad (deltas pequeños y precisos).
    const factor = Math.exp(-delta * (event.ctrlKey ? 0.012 : 0.0015));
    const point = this.point(event);
    this.camera = zoomAt(this.camera, point.x, point.y, factor);
    this.follow = false;
    this.requestFrame();
  };

  private onDoubleClick = (event: MouseEvent) => {
    if (this.pickAt(this.point(event), false)) return;
    this.center();
  };
}

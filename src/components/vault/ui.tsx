"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";

// ---------------------------------------------------------------------------
// Primitivas visuales de la bóveda
// ---------------------------------------------------------------------------

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[5px] border border-white/[0.08] bg-white/[0.04] px-1.5 py-px font-mono text-[9.5px] text-white/45">{children}</kbd>;
}

export function IconButton({ label, onClick, active, children, className = "", shortcut }: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  children: ReactNode;
  className?: string;
  shortcut?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-150 active:scale-90 ${active ? "bg-white/[0.09] text-white" : "text-white/40 hover:bg-white/[0.05] hover:text-white/85"} ${className}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Diálogos (sin alert/confirm del navegador)
// ---------------------------------------------------------------------------

type DialogRequest =
  | { kind: "prompt"; title: string; label?: string; value: string; confirm: string; selectStem?: boolean; resolve: (value: string | null) => void }
  | { kind: "confirm"; title: string; body: string; confirm: string; danger?: boolean; resolve: (value: boolean) => void }
  | { kind: "pick"; title: string; placeholder: string; options: { value: string; label: string; hint?: string }[]; resolve: (value: string | null) => void };

const useDialogStore = create<{ request: DialogRequest | null; set: (request: DialogRequest | null) => void }>((set) => ({
  request: null,
  set: (request) => set({ request }),
}));

export function askText(title: string, value = "", options: { confirm?: string; label?: string; selectStem?: boolean } = {}): Promise<string | null> {
  return new Promise((resolve) => useDialogStore.getState().set({ kind: "prompt", title, value, confirm: options.confirm ?? "Aceptar", label: options.label, selectStem: options.selectStem, resolve }));
}

export function askConfirm(title: string, body: string, options: { confirm?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => useDialogStore.getState().set({ kind: "confirm", title, body, confirm: options.confirm ?? "Confirmar", danger: options.danger, resolve }));
}

export function askPick(title: string, options: { value: string; label: string; hint?: string }[], placeholder = "Buscar…"): Promise<string | null> {
  return new Promise((resolve) => useDialogStore.getState().set({ kind: "pick", title, options, placeholder, resolve }));
}

function ModalShell({ children, onClose, width = "max-w-[420px]" }: { children: ReactNode; onClose: () => void; width?: string }) {
  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/55 px-4 pt-[16vh] backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        className={`w-full ${width} overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0e0e0e]/95 shadow-[0_30px_90px_rgba(0,0,0,0.6)] backdrop-blur-3xl`}
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 520, damping: 36 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function PromptBody({ request, close }: { request: Extract<DialogRequest, { kind: "prompt" }>; close: () => void }) {
  const [value, setValue] = useState(request.value);
  const inputRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const dot = request.selectStem ? request.value.lastIndexOf(".") : -1;
    input.setSelectionRange(0, dot > 0 ? dot : request.value.length);
  }, [request]);
  const submit = () => {
    request.resolve(value.trim() ? value.trim() : null);
    close();
  };
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      submit();
    }} className="p-4">
      <div className="mb-3 text-[12px] font-medium text-white/85">{request.title}</div>
      {request.label && <div className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-white/35">{request.label}</div>}
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            request.resolve(null);
            close();
          }
        }}
        className="vault-plain-input h-10 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 text-[13px] text-white outline-none transition focus:border-white/25 focus:bg-white/[0.06]"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={() => {
          request.resolve(null);
          close();
        }} className="h-8 rounded-lg px-3 text-[11px] text-white/45 transition hover:bg-white/[0.05] hover:text-white/80 active:scale-95">Cancelar</button>
        <button type="submit" className="h-8 rounded-lg bg-white px-3.5 text-[11px] font-medium text-black transition hover:bg-white/90 active:scale-95">{request.confirm}</button>
      </div>
    </form>
  );
}

function PickBody({ request, close }: { request: Extract<DialogRequest, { kind: "pick" }>; close: () => void }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const folded = query.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const options = request.options.filter((option) => `${option.label} ${option.hint ?? ""}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(folded)).slice(0, 80);
  const choose = (value: string | null) => {
    request.resolve(value);
    close();
  };
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);
  return (
    <div>
      <input
        autoFocus
        value={query}
        placeholder={request.placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIndex((value) => Math.min(value + 1, options.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setIndex((value) => Math.max(value - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (options[index]) choose(options[index].value);
          } else if (event.key === "Escape") choose(null);
        }}
        className="vault-plain-input h-12 w-full border-b border-white/[0.07] bg-transparent px-4 text-[14px] text-white outline-none placeholder:text-white/30"
      />
      <div className="px-4 pt-2 text-[10px] uppercase tracking-[0.12em] text-white/30">{request.title}</div>
      <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
        {options.map((option, optionIndex) => (
          <button
            key={option.value}
            type="button"
            data-index={optionIndex}
            onMouseMove={() => setIndex(optionIndex)}
            onClick={() => choose(option.value)}
            className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[12.5px] transition-colors ${optionIndex === index ? "bg-white/[0.08] text-white" : "text-white/65"}`}
          >
            <span className="truncate">{option.label}</span>
            {option.hint && <span className="shrink-0 truncate font-mono text-[10px] text-white/30">{option.hint}</span>}
          </button>
        ))}
        {!options.length && <div className="px-3 py-6 text-center text-[11px] text-white/30">Sin resultados</div>}
      </div>
    </div>
  );
}

export function VaultDialogs() {
  const request = useDialogStore((state) => state.request);
  const close = () => useDialogStore.getState().set(null);
  const cancel = () => {
    if (!request) return;
    if (request.kind === "confirm") request.resolve(false);
    else request.resolve(null);
    close();
  };

  return (
    <AnimatePresence>
      {request && (
        <ModalShell key="dialog" onClose={cancel} width={request.kind === "pick" ? "max-w-[560px]" : "max-w-[420px]"}>
          {request.kind === "prompt" && <PromptBody request={request} close={close} />}
          {request.kind === "pick" && <PickBody request={request} close={close} />}
          {request.kind === "confirm" && (
            <div className="p-4" onKeyDown={(event) => {
              if (event.key === "Escape") cancel();
            }}>
              <div className="text-[12px] font-medium text-white/85">{request.title}</div>
              <p className="mt-2 text-[12px] leading-relaxed text-white/50">{request.body}</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={cancel} className="h-8 rounded-lg px-3 text-[11px] text-white/45 transition hover:bg-white/[0.05] hover:text-white/80 active:scale-95">Cancelar</button>
                <button autoFocus type="button" onClick={() => {
                  request.resolve(true);
                  close();
                }} className={`h-8 rounded-lg px-3.5 text-[11px] font-medium transition active:scale-95 ${request.danger ? "border border-white/20 bg-white/[0.08] text-white hover:bg-white/[0.14]" : "bg-white text-black hover:bg-white/90"}`}>{request.confirm}</button>
              </div>
            </div>
          )}
        </ModalShell>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Menú contextual
// ---------------------------------------------------------------------------

export type MenuItem =
  | { label: string; icon?: ReactNode; shortcut?: string; onSelect: () => void; danger?: boolean; disabled?: boolean }
  | "separator";

const useMenuStore = create<{ menu: { x: number; y: number; items: MenuItem[] } | null; set: (menu: { x: number; y: number; items: MenuItem[] } | null) => void }>((set) => ({
  menu: null,
  set: (menu) => set({ menu }),
}));

export function openContextMenu(event: { clientX: number; clientY: number; preventDefault: () => void }, items: MenuItem[]) {
  event.preventDefault();
  useMenuStore.getState().set({ x: event.clientX, y: event.clientY, items });
}

export function VaultContextMenu() {
  const menu = useMenuStore((state) => state.menu);
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (!menu || !ref.current) {
      setPosition(null);
      return;
    }
    const { width, height } = ref.current.getBoundingClientRect();
    setPosition({
      x: Math.min(menu.x, window.innerWidth - width - 8),
      y: Math.min(menu.y, window.innerHeight - height - 8),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const close = () => useMenuStore.getState().set(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  return (
    <AnimatePresence>
      {menu && (
        <motion.div
          ref={ref}
          role="menu"
          className="fixed z-[90] min-w-[200px] rounded-xl border border-white/[0.1] bg-[#0f0f0f]/95 p-1 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-3xl"
          style={{ left: position?.x ?? menu.x, top: position?.y ?? menu.y, visibility: position ? "visible" : "hidden" }}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.12 }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {menu.items.map((item, index) => item === "separator"
            ? <div key={`separator-${index}`} className="my-1 h-px bg-white/[0.06]" />
            : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  useMenuStore.getState().set(null);
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors disabled:opacity-30 ${item.danger ? "text-white/70 hover:bg-white/[0.1] hover:text-white" : "text-white/70 hover:bg-white/[0.07] hover:text-white"}`}
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center text-white/45">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.shortcut && <span className="font-mono text-[10px] text-white/25">{item.shortcut}</span>}
              </button>
            ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Avisos breves
// ---------------------------------------------------------------------------

const useToastStore = create<{ toasts: { id: number; text: string }[]; push: (text: string) => void; drop: (id: number) => void }>((set) => ({
  toasts: [],
  push: (text) => {
    const id = Date.now() + Math.random();
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id, text }] }));
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })), 2600);
  },
  drop: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export function toast(text: string) {
  useToastStore.getState().push(text);
}

export function VaultToasts() {
  const toasts = useToastStore((state) => state.toasts);
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[95] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className="rounded-full border border-white/[0.1] bg-[#111]/95 px-4 py-2 text-[11.5px] text-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
          >
            {item.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Tipos compartidos entre el motor de la bóveda (servidor) y la interfaz.
 * Solo `import type`: este archivo no arrastra código de servidor al cliente.
 */
export type { GraphData, NoteMeta, SearchHit } from "./index";
export type { SaveResult } from "./ops";
export type { VaultSnapshot } from "@/app/actions/vault";

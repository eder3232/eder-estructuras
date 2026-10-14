import { loadPersisted, savePersisted, type LoadResult } from "@/lib/persistence";
import type { ElementRow } from "./elements";
import type { NodeRow } from "./nodes";

/**
 * Lo que se guarda de `/springs`: **el modelo, y nada más** — el mismo criterio
 * que `/armaduras-2d` (ver su `persisted-model.ts`). Los decimales, la notación
 * compacta y lo que está desplegado son preferencias de vista, no del modelo.
 *
 * Va con su propia clave y su propia versión: los sistemas no comparten forma,
 * y cambiar uno no tiene por qué descartar lo guardado del otro.
 */
export interface PersistedModel {
  nodes: NodeRow[];
  elements: ElementRow[];
  restrainedFirst: boolean;
  useDofNumbers: boolean;
}

export const MODEL_KEY = "eder-estructuras:springs";

/** Subir esto **descarta** lo guardado: solo cuando la forma cambió y no hay migración escrita. */
export const MODEL_VERSION = 1;

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

/**
 * A mano y no con un validador de esquemas, igual que en `/armaduras-2d`.
 * **Un solo campo mal descarta el modelo entero**: un modelo a medio validar
 * produce errores que el alumno no puede corregir, porque no los causó él.
 */
function isNodeRow(value: unknown): value is NodeRow {
  if (value === null || typeof value !== "object") return false;
  const node = value as Record<string, unknown>;
  return (
    isString(node.id) &&
    isString(node.name) &&
    isNumber(node.force) &&
    isNumber(node.displacement) &&
    isBoolean(node.restrained) &&
    isNumber(node.dofNumber)
  );
}

function isElementRow(value: unknown): value is ElementRow {
  if (value === null || typeof value !== "object") return false;
  const element = value as Record<string, unknown>;
  return (
    isString(element.id) &&
    isString(element.name) &&
    isString(element.fromNodeId) &&
    isString(element.toNodeId) &&
    isNumber(element.k)
  );
}

export function isPersistedModel(value: unknown): value is PersistedModel {
  if (value === null || typeof value !== "object") return false;
  const model = value as Record<string, unknown>;
  return (
    Array.isArray(model.nodes) &&
    model.nodes.every(isNodeRow) &&
    Array.isArray(model.elements) &&
    model.elements.every(isElementRow) &&
    isBoolean(model.restrainedFirst) &&
    isBoolean(model.useDofNumbers)
  );
}

/**
 * **Se lee una sola vez, al evaluarse el módulo**, y de ahí salen los valores
 * iniciales de los átomos: así no hay que setear estado después del primer
 * render ni se ve el ejemplo inicial por un cuadro. En el servidor devuelve
 * vacío, y por eso la página no dibuja las tablas hasta hidratar.
 */
const loaded: LoadResult<PersistedModel> = loadPersisted(MODEL_KEY, MODEL_VERSION, isPersistedModel);

export const storedModel = loaded.data;

/** Había algo guardado y no se pudo usar. Se avisa una vez, no se esconde. */
export const storedModelDiscarded = loaded.discarded;

export function saveModel(model: PersistedModel): void {
  savePersisted(MODEL_KEY, MODEL_VERSION, model);
}

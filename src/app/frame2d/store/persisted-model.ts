import { loadPersisted, savePersisted, type LoadResult } from "@/lib/persistence";
import type { ElementRow } from "./elements";
import type { LoadRow } from "./loads";
import type { NodeRow } from "./nodes";

/**
 * Lo que se guarda de `/frame2d`: **el modelo, y nada más** — el criterio de
 * los otros tres sistemas. Los decimales, la notación compacta, el esfuerzo
 * elegido en los diagramas o la barra aislada son preferencias de vista.
 *
 * Lo propio de pórticos son las **cargas en barras**, que son parte del modelo
 * como los nudos: guardar los FEM calculados en vez de las cargas sería volver
 * al V3 del original (un FEM que no sigue a la geometría).
 */
export interface PersistedModel {
  nodes: NodeRow[];
  elements: ElementRow[];
  loads: LoadRow[];
  restrainedFirst: boolean;
  useDofNumbers: boolean;
}

export const MODEL_KEY = "eder-estructuras:frame2d";

/** Subir esto **descarta** lo guardado: solo cuando la forma cambió y no hay migración escrita. */
export const MODEL_VERSION = 1;

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object";

const NODE_NUMBERS = [
  "x",
  "z",
  "forceX",
  "forceZ",
  "momentR",
  "displacementX",
  "displacementZ",
  "displacementR",
  "dofNumberX",
  "dofNumberZ",
  "dofNumberR",
] as const;
const NODE_BOOLEANS = ["restrainedX", "restrainedZ", "restrainedR"] as const;

const ELEMENT_NUMBERS = [
  "area",
  "elasticity",
  "inertia",
  "femAxialFrom",
  "femShearFrom",
  "femMomentFrom",
  "femAxialTo",
  "femShearTo",
  "femMomentTo",
] as const;

const LOAD_KINDS = ["distributed", "point", "moment"];
const LOAD_DIRECTIONS = ["perpendicular", "axial", "globalX", "globalZ"];
const LOAD_NUMBERS = ["q1", "q2", "a", "b"] as const;

/**
 * A mano y no con un validador de esquemas, como en los otros sistemas. **Un
 * solo campo mal descarta el modelo entero**: un modelo a medio validar produce
 * errores que el alumno no puede corregir, porque no los causó él.
 */
function isNodeRow(value: unknown): value is NodeRow {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.name) &&
    NODE_NUMBERS.every((field) => isNumber(value[field])) &&
    NODE_BOOLEANS.every((field) => isBoolean(value[field]))
  );
}

function isElementRow(value: unknown): value is ElementRow {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.fromNodeId) &&
    isString(value.toNodeId) &&
    isBoolean(value.manualFem) &&
    ELEMENT_NUMBERS.every((field) => isNumber(value[field]))
  );
}

function isLoadRow(value: unknown): value is LoadRow {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.elementId) &&
    LOAD_KINDS.includes(value.kind as string) &&
    LOAD_DIRECTIONS.includes(value.direction as string) &&
    LOAD_NUMBERS.every((field) => isNumber(value[field])) &&
    isBoolean(value.wholeBar) &&
    isBoolean(value.projected)
  );
}

export function isPersistedModel(value: unknown): value is PersistedModel {
  return (
    isObject(value) &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isNodeRow) &&
    Array.isArray(value.elements) &&
    value.elements.every(isElementRow) &&
    Array.isArray(value.loads) &&
    value.loads.every(isLoadRow) &&
    isBoolean(value.restrainedFirst) &&
    isBoolean(value.useDofNumbers)
  );
}

/**
 * **Se lee una sola vez, al evaluarse el módulo**, y de ahí salen los valores
 * iniciales de los átomos. En el servidor devuelve vacío, y por eso la página
 * no dibuja las tablas hasta hidratar.
 */
const loaded: LoadResult<PersistedModel> = loadPersisted(MODEL_KEY, MODEL_VERSION, isPersistedModel);

export const storedModel = loaded.data;

/** Había algo guardado y no se pudo usar. Se avisa una vez, no se esconde. */
export const storedModelDiscarded = loaded.discarded;

export function saveModel(model: PersistedModel): void {
  savePersisted(MODEL_KEY, MODEL_VERSION, model);
}

import { loadPersisted, savePersisted, type LoadResult } from "@/lib/persistence";
import type { ElementRow } from "./elements";
import type { NodeRow } from "./nodes";

/**
 * Lo que se guarda de `/armaduras-2d`: **el modelo, y nada más**.
 *
 * Los flags de orden de grados de libertad entran porque son parte del modelo y
 * no preferencias de la app —los puso el profesor, son datos del ejercicio— y
 * es la razón por la que viven en `store/` y no al lado de `atomDecimals` (ver
 * `dof-order.ts`).
 *
 * Lo que **no** entra, a propósito: los decimales, la notación compacta y el
 * modo práctica. Son cómo *yo* quiero ver esto, valen para los cuatro sistemas
 * a la vez y por lo tanto son otra clave, con su propio versionado. Meterlos
 * acá ataría la forma de una preferencia global al modelo de un sistema.
 *
 * Tampoco entra nada efímero: el resaltado (que es contexto, ver `N4`), qué
 * secciones del acordeón están abiertas, ni la escala de la deformada.
 */
export interface PersistedModel {
  nodes: NodeRow[];
  elements: ElementRow[];
  restrainedFirst: boolean;
  useDofNumbers: boolean;
}

export const MODEL_KEY = "eder-estructuras:armaduras-2d";

/**
 * Subir esto **descarta** lo que el usuario tenía guardado (ver
 * `lib/persistence.ts`), así que solo se sube cuando la forma cambió de verdad
 * y no hay migración escrita. Ojo: M1b ya le agregó dos campos a `NodeRow`, así
 * que esto va a pasar de nuevo.
 */
export const MODEL_VERSION = 1;

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

/**
 * La guarda se escribe a mano y no con un validador de esquemas: son dos
 * arrays de campos planos, y una dependencia más para esto no se paga sola.
 *
 * **Un solo campo mal descarta el modelo entero.** Es a propósito: un modelo a
 * medio validar produce matrices con `NaN` y errores del motor que el alumno no
 * puede corregir, porque no los causó él. Es mejor perder lo guardado y decirlo.
 */
function isNodeRow(value: unknown): value is NodeRow {
  if (value === null || typeof value !== "object") return false;
  const node = value as Record<string, unknown>;
  return (
    isString(node.id) &&
    isString(node.name) &&
    isNumber(node.x) &&
    isNumber(node.z) &&
    isNumber(node.forceX) &&
    isNumber(node.forceZ) &&
    isNumber(node.displacementX) &&
    isNumber(node.displacementZ) &&
    isBoolean(node.restrainedX) &&
    isBoolean(node.restrainedZ) &&
    isNumber(node.dofNumberX) &&
    isNumber(node.dofNumberZ)
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
    isNumber(element.area) &&
    isNumber(element.elasticity)
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
 * iniciales de los átomos. No es una optimización: si se leyera dentro de un
 * efecto habría que *setear* el estado después del primer render, que es la
 * regla de lint que este repo cuida, y además el usuario vería el ejemplo
 * inicial por un cuadro. Ver `hooks/use-hydrated.ts`, que es la otra mitad.
 *
 * En el servidor devuelve vacío, así que el HTML prerrenderizado sale con el
 * ejemplo inicial — y por eso las tablas no se dibujan hasta hidratar.
 */
const loaded: LoadResult<PersistedModel> = loadPersisted(MODEL_KEY, MODEL_VERSION, isPersistedModel);

export const storedModel = loaded.data;

/** Había algo guardado y no se pudo usar. Se avisa una vez, no se esconde. */
export const storedModelDiscarded = loaded.discarded;

export function saveModel(model: PersistedModel): void {
  savePersisted(MODEL_KEY, MODEL_VERSION, model);
}

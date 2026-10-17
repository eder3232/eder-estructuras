import { atom, createStore } from "jotai";

import { loadPersisted, savePersisted, type LoadResult } from "@/lib/persistence";
import type { LoadCombination } from "@/lib/engine";
import { isPersistedModel, type PersistedModel } from "@/app/frame2d/store/persisted-model";
import { atomPersistableModel, atomRestoreModel } from "@/app/frame2d/store/persistence";
import {
  DEFAULT_PARAMS,
  atomCombinationsBase,
  atomLevelInputsBase,
  atomNodalLoadsBase,
  atomSeismicParamsBase,
  seedSeismicElements,
  seedSeismicExtras,
  seedSeismicLoads,
  seedSeismicNodes,
  type NodalLoadRow,
  type SeismicExtras,
  type SeismicParams,
} from "./model";

/**
 * Lo que se guarda de `frame2d-seismic`: el pórtico (con la forma de
 * `/frame2d`, más el caso de cada carga) y lo propio del sismo. **Con su
 * propia clave**: los átomos del pórtico son los de `/frame2d`, pero los
 * valores son de esta página.
 */
export type PersistedSeismicModel = PersistedModel & SeismicExtras;

export const SEISMIC_MODEL_KEY = "eder-estructuras:frame2d-seismic";

/** Subir esto **descarta** lo guardado: solo cuando la forma cambió y no hay migración escrita. */
export const SEISMIC_MODEL_VERSION = 1;

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object";
const isCase = (value: unknown) => value === "CM" || value === "CV";

function isNodalLoad(value: unknown): value is NodalLoadRow {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.nodeId) &&
    isCase(value.loadCase) &&
    isNumber(value.forceX) &&
    isNumber(value.forceZ) &&
    isNumber(value.moment)
  );
}

function isParams(value: unknown): value is SeismicParams {
  if (!isObject(value)) return false;
  return (Object.keys(DEFAULT_PARAMS) as (keyof SeismicParams)[]).every((key) => {
    const expected = typeof DEFAULT_PARAMS[key];
    if (key === "periodMode") return value.periodMode === "height" || value.periodMode === "manual";
    if (key === "forceMode") return value.forceMode === "e030" || value.forceMode === "manual";
    return expected === "number" ? isNumber(value[key]) : typeof value[key] === expected;
  });
}

function isCombination(value: unknown): value is LoadCombination {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isObject(value.factors) &&
    Object.entries(value.factors).every(([key, factor]) => ["CM", "CV", "CS"].includes(key) && isNumber(factor))
  );
}

/** Un solo campo mal descarta el modelo entero, como en los otros sistemas. */
export function isPersistedSeismicModel(value: unknown): value is PersistedSeismicModel {
  if (!isPersistedModel(value)) return false;
  const model = value as PersistedModel & Record<string, unknown>;
  const levels = model.levels;
  const numbers = (list: unknown) => Array.isArray(list) && list.every(isNumber);
  return (
    model.loads.every((load) => load.loadCase === undefined || isCase(load.loadCase)) &&
    Array.isArray(model.nodalLoads) &&
    model.nodalLoads.every(isNodalLoad) &&
    isParams(model.params) &&
    isObject(levels) &&
    numbers(levels.weights) &&
    numbers(levels.manualForces) &&
    Array.isArray(model.combinations) &&
    model.combinations.every(isCombination)
  );
}

const loaded: LoadResult<PersistedSeismicModel> = loadPersisted(
  SEISMIC_MODEL_KEY,
  SEISMIC_MODEL_VERSION,
  isPersistedSeismicModel,
);

export const storedSeismicModel = loaded.data;
export const storedSeismicModelDiscarded = loaded.discarded;

export function saveSeismicModel(model: PersistedSeismicModel): void {
  savePersisted(SEISMIC_MODEL_KEY, SEISMIC_MODEL_VERSION, model);
}

export const seedSeismicModel = (): PersistedSeismicModel => ({
  nodes: seedSeismicNodes(),
  elements: seedSeismicElements(),
  loads: seedSeismicLoads(),
  restrainedFirst: false,
  useDofNumbers: false,
  ...seedSeismicExtras(),
});

export const atomSeismicPersistable = atom<PersistedSeismicModel>((get) => ({
  ...get(atomPersistableModel),
  nodalLoads: get(atomNodalLoadsBase),
  params: get(atomSeismicParamsBase),
  levels: get(atomLevelInputsBase),
  combinations: get(atomCombinationsBase),
}));

/** Pone un modelo **copiándolo** (el bug que fijó un test de `/armaduras-2d`: si no, editar edita el ejemplo). */
export const atomRestoreSeismicModel = atom(null, (get, set, model: PersistedSeismicModel) => {
  set(atomRestoreModel, model);
  set(
    atomNodalLoadsBase,
    model.nodalLoads.map((row) => ({ ...row })),
  );
  set(atomSeismicParamsBase, { ...model.params });
  set(atomLevelInputsBase, { weights: [...model.levels.weights], manualForces: [...model.levels.manualForces] });
  set(
    atomCombinationsBase,
    model.combinations.map((c) => ({ ...c, factors: { ...c.factors } })),
  );
});

/** Reemplaza el modelo y devuelve el que había, para el «Deshacer». */
export const atomReplaceSeismicModel = atom(null, (get, set, model: PersistedSeismicModel): PersistedSeismicModel => {
  const previous = get(atomSeismicPersistable);
  set(atomRestoreSeismicModel, model);
  return previous;
});

export const atomResetSeismicModel = atom(null, (get, set): PersistedSeismicModel =>
  set(atomReplaceSeismicModel, seedSeismicModel()),
);

/**
 * El store de Jotai de la página: **aísla el pórtico de `/frame2d`** (mismos
 * átomos, otros valores) y arranca con lo guardado o con el ejemplo. Los
 * átomos del pórtico traen como valor inicial el modelo de `/frame2d`, así
 * que restaurar acá no es opcional.
 */
export function createSeismicStore(model: PersistedSeismicModel | null = storedSeismicModel) {
  const store = createStore();
  store.set(atomRestoreSeismicModel, model ?? seedSeismicModel());
  return store;
}

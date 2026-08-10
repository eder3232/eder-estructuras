import { atom } from "jotai";
import { produce } from "immer";
import { seedNodeIds } from "./nodes";

export interface ElementRow {
  id: string;
  name: string;
  fromNodeId: string;
  toNodeId: string;
  area: number;
  elasticity: number;
  /** Momento de inercia de la sección: lo que `TrussElement2D` no necesitaba. */
  inertia: number;
  /**
   * Momentos (y fuerzas) de empotramiento perfecto, **en ejes locales de la
   * barra** — es como los dan las tablas. El motor se encarga de llevarlos a
   * ejes globales para el vector de cargas; acá se guardan tal cual se leen de
   * la tabla, sin transformar.
   */
  femAxialFrom: number;
  femShearFrom: number;
  femMomentFrom: number;
  femAxialTo: number;
  femShearTo: number;
  femMomentTo: number;
}

const NO_FEM = {
  femAxialFrom: 0,
  femShearFrom: 0,
  femMomentFrom: 0,
  femAxialTo: 0,
  femShearTo: 0,
  femMomentTo: 0,
};

// Mismas secciones que el caso semilla del test de regresión: columnas de
// 0.30×0.30 y viga de 0.30×0.50, con E = 15000·√210·10.
const ELASTICITY = 15000 * Math.sqrt(210) * 10;
const COLUMN = { area: 0.3 * 0.3, inertia: (0.3 * 0.3 ** 3) / 12 };
const BEAM = { area: 0.3 * 0.5, inertia: (0.3 * 0.5 ** 3) / 12 };

const initialElements: ElementRow[] = [
  {
    id: "seed-e1",
    name: "e1",
    fromNodeId: seedNodeIds.v1,
    toNodeId: seedNodeIds.v2,
    elasticity: ELASTICITY,
    ...COLUMN,
    ...NO_FEM,
  },
  {
    id: "seed-e2",
    name: "e2",
    fromNodeId: seedNodeIds.v2,
    toNodeId: seedNodeIds.v3,
    elasticity: ELASTICITY,
    ...BEAM,
    ...NO_FEM,
  },
  {
    id: "seed-e3",
    name: "e3",
    fromNodeId: seedNodeIds.v3,
    toNodeId: seedNodeIds.v4,
    elasticity: ELASTICITY,
    ...COLUMN,
    ...NO_FEM,
  },
];

const atomElementsBase = atom<ElementRow[]>(initialElements);

export const atomElements = atom((get) => get(atomElementsBase));

export const atomAddElement = atom(null, (get, set) => {
  set(
    atomElementsBase,
    produce((draft: ElementRow[]) => {
      draft.push({
        id: crypto.randomUUID(),
        name: `e${draft.length + 1}`,
        fromNodeId: "",
        toNodeId: "",
        area: 0,
        elasticity: 0,
        inertia: 0,
        ...NO_FEM,
      });
    }),
  );
});

export const atomRemoveElement = atom(null, (get, set, id: string) => {
  set(
    atomElementsBase,
    produce((draft: ElementRow[]) => {
      const index = draft.findIndex((e) => e.id === id);
      if (index !== -1) draft.splice(index, 1);
    }),
  );
});

type NumericField =
  | "area"
  | "elasticity"
  | "inertia"
  | "femAxialFrom"
  | "femShearFrom"
  | "femMomentFrom"
  | "femAxialTo"
  | "femShearTo"
  | "femMomentTo";

export const atomUpdateElementField = atom(
  null,
  (
    get,
    set,
    input:
      | { id: string; field: "name" | "fromNodeId" | "toNodeId"; value: string }
      | { id: string; field: NumericField; value: number },
  ) => {
    set(
      atomElementsBase,
      produce((draft: ElementRow[]) => {
        const element = draft.find((e) => e.id === input.id);
        if (!element) return;
        if (input.field === "name" || input.field === "fromNodeId" || input.field === "toNodeId") {
          element[input.field] = input.value as string;
        } else {
          element[input.field] = input.value as number;
        }
      }),
    );
  },
);

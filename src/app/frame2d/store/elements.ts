import { atom } from "jotai";
import { produce } from "immer";
import { insertIndex, nextRowName } from "@/lib/row-names";
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
   * `false` (lo normal): el FEM sale de las cargas de la tabla «Cargas en
   * barras». `true`: se usan los seis valores de abajo tal cual, para una carga
   * que la tabla no tenga. Es la flexibilidad que tenía el original; la barra
   * se queda sin diagramas interiores, porque sin la carga no hay con qué
   * dibujarlos (y la app lo dice, en vez de dibujar algo falso como V13).
   */
  manualFem: boolean;
  /**
   * Momentos (y fuerzas) de empotramiento perfecto escritos a mano, **en ejes
   * locales de la barra** — es como los dan las tablas. Solo cuentan con
   * `manualFem`. El motor se encarga de llevarlos a ejes globales.
   */
  femAxialFrom: number;
  femShearFrom: number;
  femMomentFrom: number;
  femAxialTo: number;
  femShearTo: number;
  femMomentTo: number;
}

const NO_FEM = {
  manualFem: false,
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

/**
 * Sin argumento agrega al final; con `afterId`, debajo de esa fila.
 *
 * Área, inercia y módulo se **heredan de la fila anterior**: `FrameElement2D`
 * rechaza valores no positivos, así que una barra nueva en cero nacía en error
 * (B1 de docs/frame2d-v1.md). Los FEM no se heredan: son de la carga de cada
 * barra, no de su sección.
 */
export const atomAddElement = atom(null, (get, set, afterId?: string) => {
  set(
    atomElementsBase,
    produce((draft: ElementRow[]) => {
      const at = insertIndex(draft, afterId);
      const previous = draft[at - 1] ?? draft[draft.length - 1];

      draft.splice(at, 0, {
        id: crypto.randomUUID(),
        name: nextRowName(
          "e",
          draft.map((e) => e.name),
        ),
        fromNodeId: "",
        toNodeId: "",
        area: previous?.area ?? BEAM.area,
        elasticity: previous?.elasticity ?? ELASTICITY,
        inertia: previous?.inertia ?? BEAM.inertia,
        ...NO_FEM,
      });
    }),
  );
});

/** Fija área, inercia y/o módulo en todas las barras de una (ver `/armaduras-2d`). */
export const atomSetAllElementsNumber = atom(
  null,
  (get, set, input: { area?: number; inertia?: number; elasticity?: number }) => {
    set(
      atomElementsBase,
      produce((draft: ElementRow[]) => {
        for (const element of draft) {
          if (input.area !== undefined) element.area = input.area;
          if (input.inertia !== undefined) element.inertia = input.inertia;
          if (input.elasticity !== undefined) element.elasticity = input.elasticity;
        }
      }),
    );
  },
);

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
      | { id: string; field: NumericField; value: number }
      | { id: string; field: "manualFem"; value: boolean },
  ) => {
    set(
      atomElementsBase,
      produce((draft: ElementRow[]) => {
        const element = draft.find((e) => e.id === input.id);
        if (!element) return;
        Object.assign(element, { [input.field]: input.value });
      }),
    );
  },
);

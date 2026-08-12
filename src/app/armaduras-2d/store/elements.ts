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
}

const AREA = 10 * 10 ** -4;
const ELASTICITY = 2 * 10 ** 7;

const initialElements: ElementRow[] = [
  { id: "seed-e1", name: "e1", fromNodeId: seedNodeIds.v1, toNodeId: seedNodeIds.v2, area: AREA, elasticity: ELASTICITY },
  { id: "seed-e2", name: "e2", fromNodeId: seedNodeIds.v3, toNodeId: seedNodeIds.v4, area: AREA, elasticity: ELASTICITY },
  { id: "seed-e3", name: "e3", fromNodeId: seedNodeIds.v1, toNodeId: seedNodeIds.v3, area: AREA, elasticity: ELASTICITY },
  { id: "seed-e4", name: "e4", fromNodeId: seedNodeIds.v2, toNodeId: seedNodeIds.v4, area: AREA, elasticity: ELASTICITY },
  { id: "seed-e5", name: "e5", fromNodeId: seedNodeIds.v1, toNodeId: seedNodeIds.v4, area: AREA, elasticity: ELASTICITY },
  { id: "seed-e6", name: "e6", fromNodeId: seedNodeIds.v2, toNodeId: seedNodeIds.v3, area: AREA, elasticity: ELASTICITY },
];

const atomElementsBase = atom<ElementRow[]>(initialElements);

export const atomElements = atom((get) => get(atomElementsBase));

/**
 * Ver `atomAddNode`: sin argumento agrega al final, con `afterId` inserta debajo
 * de esa fila.
 *
 * El área y el módulo se **heredan de la fila anterior** en vez de arrancar en
 * cero. No es comodidad: `TrussElement2D` rechaza área no positiva, así que una
 * fila nueva en cero tiraba un error de dominio y **el panel de resultados
 * entero desaparecía** hasta terminar de completarla. Una armadura además suele
 * tener el mismo material en todas las barras, así que heredar es casi siempre
 * lo que se quería.
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
        area: previous?.area ?? AREA,
        elasticity: previous?.elasticity ?? ELASTICITY,
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

/**
 * Fija área y/o módulo de elasticidad en **todas** las barras de una. Una
 * armadura real tiene el mismo material y muchas veces la misma sección en todas
 * sus barras, así que cargarlos uno por uno son dos campos por fila para escribir
 * el mismo número. El proyecto original tenía este control y el port lo perdió.
 */
export const atomSetAllElementsNumber = atom(
  null,
  (get, set, input: { area?: number; elasticity?: number }) => {
    set(
      atomElementsBase,
      produce((draft: ElementRow[]) => {
        for (const element of draft) {
          if (input.area !== undefined) element.area = input.area;
          if (input.elasticity !== undefined) element.elasticity = input.elasticity;
        }
      }),
    );
  },
);

export const atomUpdateElementField = atom(
  null,
  (
    get,
    set,
    input:
      | { id: string; field: "name" | "fromNodeId" | "toNodeId"; value: string }
      | { id: string; field: "area" | "elasticity"; value: number },
  ) => {
    set(
      atomElementsBase,
      produce((draft: ElementRow[]) => {
        const element = draft.find((e) => e.id === input.id);
        if (!element) return;
        if (input.field === "area" || input.field === "elasticity") element[input.field] = input.value as number;
        else element[input.field] = input.value as string;
      }),
    );
  },
);

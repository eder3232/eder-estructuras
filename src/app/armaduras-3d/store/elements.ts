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

const AREA = 0.002;
const ELASTICITY = 2 * 10 ** 7;

/** Las 6 barras del ejemplo de `armor3d/data/data1.ts`. */
const initialElements: ElementRow[] = [
  { id: "seed-e1", name: "e1", fromNodeId: seedNodeIds.a, toNodeId: seedNodeIds.b, area: AREA, elasticity: ELASTICITY },
  { id: "seed-e2", name: "e2", fromNodeId: seedNodeIds.b, toNodeId: seedNodeIds.c, area: AREA, elasticity: ELASTICITY },
  { id: "seed-e3", name: "e3", fromNodeId: seedNodeIds.a, toNodeId: seedNodeIds.c, area: AREA, elasticity: ELASTICITY },
  { id: "seed-e4", name: "e4", fromNodeId: seedNodeIds.a, toNodeId: seedNodeIds.d, area: AREA, elasticity: ELASTICITY },
  { id: "seed-e5", name: "e5", fromNodeId: seedNodeIds.b, toNodeId: seedNodeIds.d, area: AREA, elasticity: ELASTICITY },
  { id: "seed-e6", name: "e6", fromNodeId: seedNodeIds.c, toNodeId: seedNodeIds.d, area: AREA, elasticity: ELASTICITY },
];

const atomElementsBase = atom<ElementRow[]>(initialElements);

export const atomElements = atom((get) => get(atomElementsBase));

/**
 * Sin argumento agrega al final; con `afterId`, debajo de esa fila.
 *
 * El área y el módulo se **heredan de la fila anterior**: `TrussElement3D`
 * rechaza valores no positivos, así que una barra nueva en cero nacía en error
 * (B1 de docs/armaduras-3d-v1.md). Es la misma regla de `/armaduras-2d`, y una
 * armadura suele tener un solo material.
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

/** Fija área y/o módulo en todas las barras de una (ver `/armaduras-2d`). */
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

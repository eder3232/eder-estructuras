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

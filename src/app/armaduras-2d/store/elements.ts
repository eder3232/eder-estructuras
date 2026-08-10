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

/** Ver `atomAddNode`: sin argumento agrega al final, con `afterId` inserta debajo de esa fila. */
export const atomAddElement = atom(null, (get, set, afterId?: string) => {
  set(
    atomElementsBase,
    produce((draft: ElementRow[]) => {
      draft.splice(insertIndex(draft, afterId), 0, {
        id: crypto.randomUUID(),
        name: nextRowName(
          "e",
          draft.map((e) => e.name),
        ),
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

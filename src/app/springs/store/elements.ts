import { atom } from "jotai";
import { produce } from "immer";
import { seedNodeIds } from "./nodes";

export interface ElementRow {
  id: string;
  name: string;
  fromNodeId: string;
  toNodeId: string;
  k: number;
}

const initialElements: ElementRow[] = [
  { id: "seed-e1", name: "e1", fromNodeId: seedNodeIds.v4, toNodeId: seedNodeIds.v2, k: 10 },
  { id: "seed-e2", name: "e2", fromNodeId: seedNodeIds.v2, toNodeId: seedNodeIds.v3, k: 4 },
  { id: "seed-e3", name: "e3", fromNodeId: seedNodeIds.v3, toNodeId: seedNodeIds.v5, k: 3 },
  { id: "seed-e4", name: "e4", fromNodeId: seedNodeIds.v2, toNodeId: seedNodeIds.v1, k: 8 },
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
        k: 0,
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
      | { id: string; field: "k"; value: number },
  ) => {
    set(
      atomElementsBase,
      produce((draft: ElementRow[]) => {
        const element = draft.find((e) => e.id === input.id);
        if (!element) return;
        if (input.field === "k") element.k = input.value as number;
        else element[input.field] = input.value as string;
      }),
    );
  },
);

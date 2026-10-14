import { atom } from "jotai";
import { produce } from "immer";

import { insertIndex, nextRowName } from "@/lib/row-names";
import { seedNodeIds } from "./nodes";
import { storedModel } from "./persisted-model";

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

/** El ejemplo inicial, siempre en una copia nueva. */
export const seedElements = (): ElementRow[] => initialElements.map((e) => ({ ...e }));

export const atomElementsBase = atom<ElementRow[]>(storedModel?.elements ?? seedElements());

export const atomElements = atom((get) => get(atomElementsBase));

/**
 * Sin argumento agrega al final; con `afterId` inserta debajo de esa fila (D7).
 *
 * La `k` se **hereda de la fila anterior** en vez de arrancar en cero:
 * `SpringElement` rechaza `k ≤ 0`, así que una fila nueva en cero sería un
 * error y el panel de resultados desaparecería hasta completarla. Es lo mismo
 * que hace `/armaduras-2d` con el área y el módulo.
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
        k: previous?.k ?? 1,
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

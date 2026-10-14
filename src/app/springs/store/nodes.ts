import { atom } from "jotai";
import { produce } from "immer";

import { insertIndex, nextRowName } from "@/lib/row-names";
import { storedModel } from "./persisted-model";

export interface NodeRow {
  /** Identificador estable, nunca editable — lo referencian los elementos. */
  id: string;
  /** Etiqueta editable que se muestra en la UI. */
  name: string;
  force: number;
  displacement: number;
  restrained: boolean;
  /**
   * El número que el alumno le pone al grado de libertad del nudo. Solo se usa
   * con la numeración manual encendida (`atomUseDofNumbers`); `0` es "sin
   * numerar" y deja el orden de la tabla. Ver M1b en `/armaduras-2d`.
   */
  dofNumber: number;
}

export const seedNodeIds = {
  v1: "seed-v1",
  v2: "seed-v2",
  v3: "seed-v3",
  v4: "seed-v4",
  v5: "seed-v5",
} as const;

const node = (id: string, name: string, force: number, restrained: boolean): NodeRow => ({
  id,
  name,
  force,
  displacement: 0,
  restrained,
  dofNumber: 0,
});

const initialNodes: NodeRow[] = [
  node(seedNodeIds.v4, "v4", 0, true),
  node(seedNodeIds.v5, "v5", 0, true),
  node(seedNodeIds.v1, "v1", 5, false),
  node(seedNodeIds.v2, "v2", 4, false),
  node(seedNodeIds.v3, "v3", 0, false),
];

/** El ejemplo inicial, siempre en una copia nueva (ver `seedNodes` de `/armaduras-2d`). */
export const seedNodes = (): NodeRow[] => initialNodes.map((n) => ({ ...n }));

// Exportado solo para el orden de grados de libertad (que siembra la numeración
// al encenderla) y para la persistencia (que lo pisa al restaurar).
export const atomNodesBase = atom<NodeRow[]>(storedModel?.nodes ?? seedNodes());

export const atomNodes = atom((get) => get(atomNodesBase));

/**
 * Sin argumento agrega al final; con `afterId` inserta justo debajo de esa
 * fila. El orden de las filas es el orden de los grados de libertad, así que
 * insertar en el medio tiene sentido (D7).
 *
 * El nombre sale de `nextRowName` y no de `v${length + 1}`: con esa cuenta,
 * borrar `v4` y agregar daba un segundo `v5` (B3, 2026-10-14).
 */
export const atomAddNode = atom(null, (get, set, afterId?: string) => {
  set(
    atomNodesBase,
    produce((draft: NodeRow[]) => {
      draft.splice(
        insertIndex(draft, afterId),
        0,
        node(
          crypto.randomUUID(),
          nextRowName(
            "v",
            draft.map((n) => n.name),
          ),
          0,
          false,
        ),
      );
    }),
  );
});

export const atomRemoveNode = atom(null, (get, set, id: string) => {
  set(
    atomNodesBase,
    produce((draft: NodeRow[]) => {
      const index = draft.findIndex((n) => n.id === id);
      if (index !== -1) draft.splice(index, 1);
    }),
  );
});

export const atomUpdateNodeField = atom(
  null,
  (
    get,
    set,
    input:
      | { id: string; field: "name"; value: string }
      | { id: string; field: "force" | "displacement" | "dofNumber"; value: number },
  ) => {
    set(
      atomNodesBase,
      produce((draft: NodeRow[]) => {
        const target = draft.find((n) => n.id === input.id);
        if (!target) return;
        if (input.field === "name") target.name = input.value;
        else target[input.field] = input.value;
      }),
    );
  },
);

export const atomToggleNodeRestrained = atom(null, (get, set, id: string) => {
  set(
    atomNodesBase,
    produce((draft: NodeRow[]) => {
      const target = draft.find((n) => n.id === id);
      if (!target) return;
      target.restrained = !target.restrained;
      // System.addNode rechaza fuerza en un DOF restringido y desplazamiento en uno libre.
      if (target.restrained) target.force = 0;
      else target.displacement = 0;
    }),
  );
});

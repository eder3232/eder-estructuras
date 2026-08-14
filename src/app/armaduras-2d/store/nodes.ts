import { atom } from "jotai";
import { produce } from "immer";

import { insertIndex, nextRowName } from "@/lib/row-names";
import { storedModel } from "./persisted-model";

export interface NodeRow {
  /** Identificador estable, nunca editable — lo referencian los elementos. */
  id: string;
  /** Etiqueta editable que se muestra en la UI. */
  name: string;
  x: number;
  z: number;
  forceX: number;
  forceZ: number;
  displacementX: number;
  displacementZ: number;
  restrainedX: boolean;
  restrainedZ: boolean;
  /**
   * El número que el alumno le pone a cada grado de libertad. Solo se usa si
   * la numeración manual está encendida (`atomUseDofNumbers`); el `0` es "sin
   * numerar" y deja el orden de la tabla.
   */
  dofNumberX: number;
  dofNumberZ: number;
}

export const seedNodeIds = {
  v1: "seed-v1",
  v2: "seed-v2",
  v3: "seed-v3",
  v4: "seed-v4",
} as const;

const initialNodes: NodeRow[] = [
  {
    id: seedNodeIds.v1,
    name: "v1",
    x: 0,
    z: 0,
    forceX: 0,
    forceZ: 0,
    displacementX: 0,
    displacementZ: 0,
    restrainedX: true,
    restrainedZ: true,
    dofNumberX: 0,
    dofNumberZ: 0,
  },
  {
    id: seedNodeIds.v2,
    name: "v2",
    x: 3,
    z: 0,
    forceX: 0,
    forceZ: 0,
    displacementX: 0,
    displacementZ: 0,
    restrainedX: true,
    restrainedZ: true,
    dofNumberX: 0,
    dofNumberZ: 0,
  },
  {
    id: seedNodeIds.v3,
    name: "v3",
    x: 0,
    z: 4,
    forceX: 4.8,
    forceZ: -6.4,
    displacementX: 0,
    displacementZ: 0,
    restrainedX: false,
    restrainedZ: false,
    dofNumberX: 0,
    dofNumberZ: 0,
  },
  {
    id: seedNodeIds.v4,
    name: "v4",
    x: 3,
    z: 4,
    forceX: 0,
    forceZ: -6,
    displacementX: 0,
    displacementZ: 0,
    restrainedX: false,
    restrainedZ: false,
    dofNumberX: 0,
    dofNumberZ: 0,
  },
];

/**
 * El ejemplo inicial, siempre en una copia nueva: es también a donde vuelve el
 * botón de reset, y devolver el array de módulo dejaría que una edición
 * posterior lo mutara.
 */
export const seedNodes = (): NodeRow[] => initialNodes.map((node) => ({ ...node }));

// Exportado —y solo para `dof-order.ts` y `persistence.ts`— porque encender la
// numeración manual tiene que poder sembrarla y el reset tiene que poder
// pisarla; ver el porqué ahí.
export const atomNodesBase = atom<NodeRow[]>(storedModel?.nodes ?? seedNodes());

export const atomNodes = atom((get) => get(atomNodesBase));

/**
 * Sin argumento agrega al final (botón del encabezado); con `afterId` inserta
 * justo debajo de esa fila, para poder meter un nudo intermedio sin rehacer la
 * tabla. El orden de las filas es el orden de los DOF, así que insertar en el
 * medio es una operación con sentido, no solo cosmética.
 */
export const atomAddNode = atom(null, (get, set, afterId?: string) => {
  set(
    atomNodesBase,
    produce((draft: NodeRow[]) => {
      draft.splice(insertIndex(draft, afterId), 0, {
        id: crypto.randomUUID(),
        name: nextRowName(
          "v",
          draft.map((n) => n.name),
        ),
        x: 0,
        z: 0,
        forceX: 0,
        forceZ: 0,
        displacementX: 0,
        displacementZ: 0,
        restrainedX: false,
        restrainedZ: false,
        dofNumberX: 0,
        dofNumberZ: 0,
      });
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

type NumericField =
  | "x"
  | "z"
  | "forceX"
  | "forceZ"
  | "displacementX"
  | "displacementZ"
  | "dofNumberX"
  | "dofNumberZ";

export const atomUpdateNodeField = atom(
  null,
  (
    get,
    set,
    input: { id: string; field: "name"; value: string } | { id: string; field: NumericField; value: number },
  ) => {
    set(
      atomNodesBase,
      produce((draft: NodeRow[]) => {
        const node = draft.find((n) => n.id === input.id);
        if (!node) return;
        if (input.field === "name") node.name = input.value as string;
        else node[input.field] = input.value as number;
      }),
    );
  },
);

/** axis: "x" togglea restrainedX, "z" togglea restrainedZ. */
export const atomToggleNodeRestrained = atom(null, (get, set, { id, axis }: { id: string; axis: "x" | "z" }) => {
  set(
    atomNodesBase,
    produce((draft: NodeRow[]) => {
      const node = draft.find((n) => n.id === id);
      if (!node) return;
      // System.addNode rechaza fuerza en un DOF restringido y desplazamiento en uno libre.
      if (axis === "x") {
        node.restrainedX = !node.restrainedX;
        if (node.restrainedX) node.forceX = 0;
        else node.displacementX = 0;
      } else {
        node.restrainedZ = !node.restrainedZ;
        if (node.restrainedZ) node.forceZ = 0;
        else node.displacementZ = 0;
      }
    }),
  );
});

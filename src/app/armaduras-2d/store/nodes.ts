import { atom } from "jotai";
import { produce } from "immer";

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
  },
];

const atomNodesBase = atom<NodeRow[]>(initialNodes);

export const atomNodes = atom((get) => get(atomNodesBase));

export const atomAddNode = atom(null, (get, set) => {
  set(
    atomNodesBase,
    produce((draft: NodeRow[]) => {
      draft.push({
        id: crypto.randomUUID(),
        name: `v${draft.length + 1}`,
        x: 0,
        z: 0,
        forceX: 0,
        forceZ: 0,
        displacementX: 0,
        displacementZ: 0,
        restrainedX: false,
        restrainedZ: false,
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

type NumericField = "x" | "z" | "forceX" | "forceZ" | "displacementX" | "displacementZ";

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

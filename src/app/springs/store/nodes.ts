import { atom } from "jotai";
import { produce } from "immer";

export interface NodeRow {
  /** Identificador estable, nunca editable — lo referencian los elementos. */
  id: string;
  /** Etiqueta editable que se muestra en la UI. */
  name: string;
  force: number;
  displacement: number;
  restrained: boolean;
}

export const seedNodeIds = {
  v1: "seed-v1",
  v2: "seed-v2",
  v3: "seed-v3",
  v4: "seed-v4",
  v5: "seed-v5",
} as const;

const initialNodes: NodeRow[] = [
  { id: seedNodeIds.v4, name: "v4", force: 0, displacement: 0, restrained: true },
  { id: seedNodeIds.v5, name: "v5", force: 0, displacement: 0, restrained: true },
  { id: seedNodeIds.v1, name: "v1", force: 5, displacement: 0, restrained: false },
  { id: seedNodeIds.v2, name: "v2", force: 4, displacement: 0, restrained: false },
  { id: seedNodeIds.v3, name: "v3", force: 0, displacement: 0, restrained: false },
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
        force: 0,
        displacement: 0,
        restrained: false,
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

export const atomUpdateNodeField = atom(
  null,
  (
    get,
    set,
    { id, field, value }: { id: string; field: "name"; value: string } | { id: string; field: "force" | "displacement"; value: number },
  ) => {
    set(
      atomNodesBase,
      produce((draft: NodeRow[]) => {
        const node = draft.find((n) => n.id === id);
        if (!node) return;
        if (field === "name") node.name = value as string;
        else node[field] = value as number;
      }),
    );
  },
);

export const atomToggleNodeRestrained = atom(null, (get, set, id: string) => {
  set(
    atomNodesBase,
    produce((draft: NodeRow[]) => {
      const node = draft.find((n) => n.id === id);
      if (!node) return;
      node.restrained = !node.restrained;
      // System.addNode rechaza fuerza en un DOF restringido y desplazamiento en uno libre.
      if (node.restrained) node.force = 0;
      else node.displacement = 0;
    }),
  );
});

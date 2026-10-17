import { atom } from "jotai";
import { produce } from "immer";

import type { LoadDirection, MemberLoad } from "@/lib/engine";
import { insertIndex, nextRowName } from "@/lib/row-names";
import { atomElements } from "./elements";
import { storedModel } from "./persisted-model";

export type LoadKind = MemberLoad["kind"];

/**
 * Una carga a lo largo de una barra, como fila de la tabla «Cargas en barras».
 *
 * **Es el dato; el FEM se calcula** (`loadFixedEndForces`, en el motor), así
 * que no hay FEM guardado que se pueda quedar viejo al mover un nudo — el bug
 * V3 del original.
 *
 * Una sola forma plana para los tres tipos, como el resto de las filas del
 * repo: lo que un tipo no usa queda guardado y la tabla lo deshabilita. Así
 * cambiar de tipo y volver no pierde lo escrito.
 * - distribuida: `q1` en `a`, `q2` en `b`.
 * - puntual y momento: el valor es `q1` y la posición, `a`.
 */
export interface LoadRow {
  id: string;
  name: string;
  elementId: string;
  kind: LoadKind;
  /** No aplica al momento, que no tiene dirección en el plano. */
  direction: LoadDirection;
  q1: number;
  q2: number;
  /**
   * Distribuida sobre toda la barra: `a = 0` y `b = L` **con la L de ahora**.
   * Es el caso más común, y guardar `b` como número haría que mover un nudo
   * dejara la carga corta (o fuera de la barra) sin que nadie lo pidiera.
   */
  wholeBar: boolean;
  a: number;
  b: number;
  /** Intensidad por unidad de proyección; solo distribuidas en dirección global. */
  projected: boolean;
  /**
   * El caso de carga: **solo lo usa `frame2d-seismic`** (los casos son
   * exclusivos de ese módulo, decisión del 2026-10-17). `/frame2d` no lo
   * mira ni lo guarda. Sin valor es carga muerta. Al agregar una fila se
   * copia de la de arriba, como el resto.
   */
  loadCase?: "CM" | "CV";
}

// Exportado solo para la persistencia, que lo pisa al restaurar.
export const atomLoadsBase = atom<LoadRow[]>(storedModel?.loads ?? []);

export const atomLoads = atom((get) => get(atomLoadsBase));

/**
 * Sin `afterId` agrega al final; con él, debajo de esa fila. **Copia la fila
 * de arriba** salvo el nombre: cargar la misma carga en varias barras es lo
 * habitual (todas las vigas de un piso), y una fila en blanco obligaría a
 * reelegir tipo, dirección y valor cada vez.
 *
 * La primera carga va en la primera barra: sin barra nacía en error, el mismo
 * B1 que tenían las barras nuevas (lo encontró mirar la app).
 */
export const atomAddLoad = atom(null, (get, set, input?: { afterId?: string; elementId?: string }) => {
  set(
    atomLoadsBase,
    produce((draft: LoadRow[]) => {
      const at = insertIndex(draft, input?.afterId);
      const previous = draft[at - 1] ?? draft[draft.length - 1];
      const base: Omit<LoadRow, "id" | "name"> = previous
        ? { ...previous }
        : {
            elementId: get(atomElements)[0]?.id ?? "",
            kind: "distributed",
            direction: "globalZ",
            q1: 0,
            q2: 0,
            wholeBar: true,
            a: 0,
            b: 0,
            projected: false,
          };

      draft.splice(at, 0, {
        ...base,
        id: crypto.randomUUID(),
        name: nextRowName(
          "c",
          draft.map((l) => l.name),
        ),
        elementId: input?.elementId ?? base.elementId,
      });
    }),
  );
});

export const atomRemoveLoad = atom(null, (get, set, id: string) => {
  set(
    atomLoadsBase,
    produce((draft: LoadRow[]) => {
      const index = draft.findIndex((l) => l.id === id);
      if (index !== -1) draft.splice(index, 1);
    }),
  );
});

type LoadUpdate =
  | { id: string; field: "name" | "elementId"; value: string }
  | { id: string; field: "kind"; value: LoadKind }
  | { id: string; field: "direction"; value: LoadDirection }
  | { id: string; field: "q1" | "q2" | "a" | "b"; value: number }
  | { id: string; field: "wholeBar" | "projected"; value: boolean }
  | { id: string; field: "loadCase"; value: "CM" | "CV" };

export const atomUpdateLoadField = atom(null, (get, set, input: LoadUpdate) => {
  set(
    atomLoadsBase,
    produce((draft: LoadRow[]) => {
      const load = draft.find((l) => l.id === input.id);
      if (!load) return;
      Object.assign(load, { [input.field]: input.value });
    }),
  );
});

/** Lo que una fila significa para el motor, con la L actual de su barra. */
export function toMemberLoad(load: LoadRow, length: number): MemberLoad {
  if (load.kind === "moment") return { kind: "moment", value: load.q1, a: load.a };
  if (load.kind === "point") return { kind: "point", direction: load.direction, value: load.q1, a: load.a };
  return {
    kind: "distributed",
    direction: load.direction,
    q1: load.q1,
    q2: load.q2,
    a: load.wholeBar ? 0 : load.a,
    b: load.wholeBar ? length : load.b,
    projected: load.projected && (load.direction === "globalX" || load.direction === "globalZ"),
  };
}

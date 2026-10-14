import { atom } from "jotai";
import { produce } from "immer";

import { atomNodes, atomNodesBase, type NodeRow } from "./nodes";
import { storedModel } from "./persisted-model";

/**
 * Los dos interruptores de orden de los grados de libertad, los mismos que
 * `/armaduras-2d` (M1a y M1b; el porqué está en `docs/pendientes-comparacion.md`,
 * grupo M). El motor ya los soporta para cualquier sistema: acá solo se guarda
 * qué eligió el alumno.
 */
export const atomRestrainedFirstBase = atom(storedModel?.restrainedFirst ?? false);

export const atomRestrainedFirst = atom((get) => get(atomRestrainedFirstBase));

export const atomToggleRestrainedFirst = atom(null, (get, set) => {
  set(atomRestrainedFirstBase, !get(atomRestrainedFirstBase));
});

export const atomUseDofNumbersBase = atom(storedModel?.useDofNumbers ?? false);

export const atomUseDofNumbers = atom((get) => get(atomUseDofNumbersBase));

/**
 * Al encender la numeración manual sin nada cargado, se siembra con el orden
 * de la tabla (1, 2, 3…): así no cambia nada hasta que el alumno edita un
 * número, que es lo que se espera de un interruptor que todavía no se usó.
 */
export const atomToggleUseDofNumbers = atom(null, (get, set) => {
  const encendiendo = !get(atomUseDofNumbersBase);

  if (encendiendo && get(atomNodes).every((n) => n.dofNumber === 0)) {
    set(
      atomNodesBase,
      produce((draft: NodeRow[]) => {
        draft.forEach((node, i) => {
          node.dofNumber = i + 1;
        });
      }),
    );
  }

  set(atomUseDofNumbersBase, encendiendo);
});

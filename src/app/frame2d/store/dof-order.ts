import { atom } from "jotai";
import { produce } from "immer";

import { atomNodes, atomNodesBase, type NodeRow } from "./nodes";
import { storedModel } from "./persisted-model";

/**
 * Los dos interruptores de orden de los grados de libertad (M1a y M1b), los
 * mismos de `/armaduras-2d`. El `frame2d` original también los tenía
 * (`areRestrictedsOnTop`, `areDofDefinedByUser`): es un rescate. Son parte del
 * modelo y no una preferencia de pantalla: los decidió el enunciado. El porqué
 * de cada uno está en `src/app/armaduras-2d/store/dof-order.ts`.
 */
export const atomRestrainedFirstBase = atom(storedModel?.restrainedFirst ?? false);

export const atomRestrainedFirst = atom((get) => get(atomRestrainedFirstBase));

export const atomToggleRestrainedFirst = atom(null, (get, set) => {
  set(atomRestrainedFirstBase, !get(atomRestrainedFirstBase));
});

export const atomUseDofNumbersBase = atom(storedModel?.useDofNumbers ?? false);

export const atomUseDofNumbers = atom((get) => get(atomUseDofNumbersBase));

/** Al encenderla sin nada cargado, se siembra con el orden de la tabla: 1, 2, 3 para el primer nudo… */
export const atomToggleUseDofNumbers = atom(null, (get, set) => {
  const encendiendo = !get(atomUseDofNumbersBase);

  if (encendiendo && get(atomNodes).every((n) => n.dofNumberX === 0 && n.dofNumberZ === 0 && n.dofNumberR === 0)) {
    set(
      atomNodesBase,
      produce((draft: NodeRow[]) => {
        draft.forEach((node, i) => {
          node.dofNumberX = i * 3 + 1;
          node.dofNumberZ = i * 3 + 2;
          node.dofNumberR = i * 3 + 3;
        });
      }),
    );
  }

  set(atomUseDofNumbersBase, encendiendo);
});

import { atom } from "jotai";
import { produce } from "immer";

import { atomNodes, atomNodesBase, type NodeRow } from "./nodes";

/**
 * Si los grados de libertad restringidos van arriba en la matriz global.
 *
 * **Es parte del modelo, no una preferencia de la app.** Los decimales o la
 * notación compacta son cómo *yo* quiero ver las cosas; esto es cómo está
 * planteado *este* ejercicio, y lo decidió el profesor. Cuando N1 permita
 * guardar o compartir un problema tiene que viajar con él: si no, el que lo
 * abre ve otras matrices que las del que lo mandó.
 *
 * Por eso vive en `store/` junto a los nudos y las barras, y no al lado de
 * `atomDecimals`.
 */
const atomRestrainedFirstBase = atom(false);

export const atomRestrainedFirst = atom((get) => get(atomRestrainedFirstBase));

export const atomToggleRestrainedFirst = atom(null, (get, set) => {
  set(atomRestrainedFirstBase, !get(atomRestrainedFirstBase));
});

/**
 * Si el alumno numera los grados de libertad a mano.
 *
 * **Existe porque el profesor a veces numera de una forma rara a propósito**,
 * para ver si el alumno entendió el método — y el alumno quiere cotejar sus
 * matrices contra las de la pantalla término a término. Es parte del modelo por
 * la misma razón que el orden: lo decidió el enunciado, no el que mira.
 */
const atomUseDofNumbersBase = atom(false);

export const atomUseDofNumbers = atom((get) => get(atomUseDofNumbersBase));

/**
 * Al encenderla, **siembra la numeración con el orden que hay ahora** (1, 2,
 * 3…) en vez de dejar todo en cero.
 *
 * Es la diferencia entre "acá tenés el orden actual, cambiá lo que quieras" y
 * "arreglátelas": con ceros el alumno tendría que tipear los ocho números antes
 * de que la tabla vuelva a tener sentido, y mientras tanto el orden salta en
 * cada tecla. Se siembra por orden de fila, que es el orden por defecto.
 */
export const atomToggleUseDofNumbers = atom(null, (get, set) => {
  const encendiendo = !get(atomUseDofNumbersBase);

  if (encendiendo && get(atomNodes).every((n) => n.dofNumberX === 0 && n.dofNumberZ === 0)) {
    set(
      atomNodesBase,
      produce((draft: NodeRow[]) => {
        draft.forEach((node, i) => {
          node.dofNumberX = i * 2 + 1;
          node.dofNumberZ = i * 2 + 2;
        });
      }),
    );
  }

  set(atomUseDofNumbersBase, encendiendo);
});

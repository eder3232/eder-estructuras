import { atom } from "jotai";

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

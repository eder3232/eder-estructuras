import { atom } from "jotai";

import { atomElements, atomElementsBase, seedElements } from "./elements";
import { atomNodes, atomNodesBase, seedNodes } from "./nodes";
import {
  atomRestrainedFirst,
  atomRestrainedFirstBase,
  atomUseDofNumbers,
  atomUseDofNumbersBase,
} from "./dof-order";
import type { PersistedModel } from "./persisted-model";

/**
 * El modelo entero en un solo valor, que es lo que se guarda y lo que se
 * restaura.
 *
 * Es un átomo derivado y no una función suelta para que **el que escribe no
 * tenga que enterarse de cada acción del store**: hay una docena de acciones
 * que tocan nudos y barras, y agregarle un `saveModel()` a cada una es una
 * lista que alguien va a olvidar de actualizar. Acá se observa el resultado.
 */
export const atomPersistableModel = atom<PersistedModel>((get) => ({
  nodes: get(atomNodes),
  elements: get(atomElements),
  restrainedFirst: get(atomRestrainedFirst),
  useDofNumbers: get(atomUseDofNumbers),
}));

/**
 * Vuelve al ejemplo inicial y **devuelve lo que había**, que es lo que hace
 * posible el "deshacer".
 *
 * Es "volver al ejemplo inicial" y no "vaciar todo" por decisión del usuario:
 * una página en blanco no le enseña nada a nadie, y borrar las filas a mano ya
 * se puede.
 */
export const atomResetModel = atom(null, (get, set): PersistedModel => {
  const previo = get(atomPersistableModel);

  set(atomNodesBase, seedNodes());
  set(atomElementsBase, seedElements());
  set(atomRestrainedFirstBase, false);
  set(atomUseDofNumbersBase, false);

  return previo;
});

/** La vuelta atrás del reset — y, el día que llegue N2, la de cargar un ejemplo. */
export const atomRestoreModel = atom(null, (get, set, model: PersistedModel) => {
  set(atomNodesBase, model.nodes);
  set(atomElementsBase, model.elements);
  set(atomRestrainedFirstBase, model.restrainedFirst);
  set(atomUseDofNumbersBase, model.useDofNumbers);
});

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
 * Pisa el modelo entero y **devuelve lo que había**, que es lo que hace posible
 * el "deshacer".
 *
 * Lo usan las dos acciones que reemplazan todo de una: volver al ejemplo
 * inicial y cargar un ejemplo. Es la misma operación con distinto contenido, y
 * por eso la vuelta atrás se escribió una sola vez.
 */
export const atomReplaceModel = atom(null, (get, set, model: PersistedModel): PersistedModel => {
  const previo = get(atomPersistableModel);

  set(atomRestoreModel, model);

  return previo;
});

/**
 * Vuelve al ejemplo inicial.
 *
 * Es "volver al ejemplo inicial" y no "vaciar todo" por decisión del usuario:
 * una página en blanco no le enseña nada a nadie, y borrar las filas a mano ya
 * se puede.
 */
export const atomResetModel = atom(null, (get, set): PersistedModel =>
  set(atomReplaceModel, {
    nodes: seedNodes(),
    elements: seedElements(),
    restrainedFirst: false,
    useDofNumbers: false,
  }),
);

/**
 * Poner un modelo concreto: la vuelta atrás del "deshacer", y el camino por el
 * que entran los ejemplos precargados.
 *
 * **Copia las filas.** Sin eso, cargar un ejemplo dejaría al store apuntando a
 * los mismos objetos del módulo de ejemplos, y editar una fila de la tabla
 * ensuciaría el ejemplo para toda la sesión — cargarlo dos veces daría cosas
 * distintas. Vale igual para el modelo que guarda el "deshacer".
 */
export const atomRestoreModel = atom(null, (get, set, model: PersistedModel) => {
  set(
    atomNodesBase,
    model.nodes.map((node) => ({ ...node })),
  );
  set(
    atomElementsBase,
    model.elements.map((element) => ({ ...element })),
  );
  set(atomRestrainedFirstBase, model.restrainedFirst);
  set(atomUseDofNumbersBase, model.useDofNumbers);
});

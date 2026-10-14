import { atom } from "jotai";

import {
  atomRestrainedFirst,
  atomRestrainedFirstBase,
  atomUseDofNumbers,
  atomUseDofNumbersBase,
} from "./dof-order";
import { atomElements, atomElementsBase, seedElements } from "./elements";
import { atomNodes, atomNodesBase, seedNodes } from "./nodes";
import type { PersistedModel } from "./persisted-model";

/** El modelo entero tal como se guarda. Lo que no está acá no se persiste. */
export const atomPersistableModel = atom<PersistedModel>((get) => ({
  nodes: get(atomNodes),
  elements: get(atomElements),
  restrainedFirst: get(atomRestrainedFirst),
  useDofNumbers: get(atomUseDofNumbers),
}));

/** Reemplaza el modelo y devuelve el que había, para el «Deshacer». */
export const atomReplaceModel = atom(null, (get, set, model: PersistedModel): PersistedModel => {
  const previo = get(atomPersistableModel);
  set(atomRestoreModel, model);
  return previo;
});

export const atomResetModel = atom(null, (get, set): PersistedModel =>
  set(atomReplaceModel, {
    nodes: seedNodes(),
    elements: seedElements(),
    restrainedFirst: false,
    useDofNumbers: false,
  }),
);

/**
 * Pone un modelo, **copiándolo**: si el store quedara apuntando a los objetos
 * de un ejemplo, editar una fila editaría el ejemplo, y cargarlo dos veces no
 * daría lo mismo. Es el bug que un test de `/armaduras-2d` fijó.
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

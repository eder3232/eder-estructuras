"use client";

import { useAtomValue, useSetAtom } from "jotai";

import {
  ExamplesMenu as GenericExamplesMenu,
  ModelPersistence as GenericModelPersistence,
  ResetModelButton as GenericResetModelButton,
} from "@/components/custom/model-persistence";
import { examples } from "../store/examples";
import { MODEL_KEY, saveModel, storedModelDiscarded } from "../store/persisted-model";
import { atomPersistableModel, atomReplaceModel, atomResetModel, atomRestoreModel } from "../store/persistence";

/** Las piezas genéricas de `custom/model-persistence.tsx`, con el estado de `/armaduras-3d`. */
export function ModelPersistence() {
  const model = useAtomValue(atomPersistableModel);
  return (
    <GenericModelPersistence model={model} save={saveModel} storageKey={MODEL_KEY} discarded={storedModelDiscarded} />
  );
}

export function ResetModelButton() {
  const reset = useSetAtom(atomResetModel);
  const restore = useSetAtom(atomRestoreModel);
  return <GenericResetModelButton onReset={reset} onRestore={restore} />;
}

export function ExamplesMenu() {
  const replace = useSetAtom(atomReplaceModel);
  const restore = useSetAtom(atomRestoreModel);
  // `start`: el párrafo de la página es largo y los botones bajan debajo del
  // título, a la izquierda; abriendo hacia el final el menú salía de la columna
  // (medido: borde izquierdo en 0 contra 36 de la columna). Lo de `/springs`.
  return <GenericExamplesMenu examples={examples} onReplace={replace} onRestore={restore} align="start" />;
}

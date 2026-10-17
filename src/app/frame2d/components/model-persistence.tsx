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

/** Las piezas genéricas de `custom/model-persistence.tsx`, con el estado de `/frame2d`. */
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
  // `start`: con el párrafo largo de la página los botones bajan debajo del
  // título, y abriendo hacia el final el menú salía de la columna (lo de `/springs`).
  return <GenericExamplesMenu examples={examples} onReplace={replace} onRestore={restore} align="start" />;
}

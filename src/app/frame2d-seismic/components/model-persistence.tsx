"use client";

import { useAtomValue, useSetAtom } from "jotai";

import {
  ModelPersistence as GenericModelPersistence,
  ResetModelButton as GenericResetModelButton,
} from "@/components/custom/model-persistence";
import {
  SEISMIC_MODEL_KEY,
  atomResetSeismicModel,
  atomRestoreSeismicModel,
  atomSeismicPersistable,
  saveSeismicModel,
  storedSeismicModelDiscarded,
} from "../store/persistence";

/**
 * Las piezas genéricas de `custom/model-persistence.tsx`, con el modelo
 * sísmico y **su** clave. La de `/frame2d` no se puede montar acá: guardaría
 * este pórtico encima del de `/frame2d`.
 */
export function ModelPersistence() {
  const model = useAtomValue(atomSeismicPersistable);
  return (
    <GenericModelPersistence
      model={model}
      save={saveSeismicModel}
      storageKey={SEISMIC_MODEL_KEY}
      discarded={storedSeismicModelDiscarded}
    />
  );
}

export function ResetModelButton() {
  const reset = useSetAtom(atomResetSeismicModel);
  const restore = useSetAtom(atomRestoreSeismicModel);
  return <GenericResetModelButton onReset={reset} onRestore={restore} />;
}

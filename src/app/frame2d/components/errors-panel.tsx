"use client";

import { useAtom } from "jotai";

import { ErrorsPanel as GenericErrorsPanel } from "@/components/custom/errors-panel";
import { useFrame2DView } from "../frame2d-view";

/**
 * Errores de datos y advertencias, donde se los corrige. Con las dos reglas de
 * `/armaduras-2d` (ver `docs/errores.md`): el mecanismo se filtra porque es una
 * salida del cálculo y va en Resultados, y las advertencias conviven con los
 * resultados.
 */
export function ErrorsPanel() {
  const { atomResults } = useFrame2DView();
  const [results] = useAtom(atomResults);

  if (results.status === "ok") return <GenericErrorsPanel issues={results.warnings} />;
  if (results.status !== "error") return null;

  return <GenericErrorsPanel issues={results.errors.filter((e) => !e.mechanism)} />;
}

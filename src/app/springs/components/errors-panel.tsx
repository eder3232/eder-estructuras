"use client";

import { useAtom } from "jotai";

import { ErrorsPanel as GenericErrorsPanel } from "@/components/custom/errors-panel";
import { atomResults } from "../store/results";

/**
 * Lo que hay que decir sobre el modelo, donde se lo corrige: errores de datos y
 * advertencias. Con las mismas dos reglas que `/armaduras-2d` (ver su panel y
 * `docs/errores.md`): el mecanismo se filtra porque es una salida del cálculo y
 * va en Resultados, y las advertencias conviven con los resultados.
 */
export function ErrorsPanel() {
  const [results] = useAtom(atomResults);

  if (results.status === "ok") return <GenericErrorsPanel issues={results.warnings} />;
  if (results.status !== "error") return null;

  return <GenericErrorsPanel issues={results.errors.filter((e) => !e.mechanism)} />;
}

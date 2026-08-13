"use client";

import { useAtom } from "jotai";

import { ErrorsPanel as GenericErrorsPanel } from "@/components/custom/errors-panel";
import { atomResults } from "../store/results";

/**
 * Lo que hay que decir **sobre el modelo**, en el lugar donde se lo corrige:
 * los errores de datos de entrada, y las advertencias.
 *
 * Dos cosas que no se mezclan, y el porqué está en `docs/errores.md`:
 *
 * - El **error de mecanismo se filtra**. No es un dato mal cargado, es lo que
 *   produjo el cálculo, y encima no se puede atribuir a ninguna fila (viaja
 *   con `refId: "-"`). Se muestra entero, con su dibujo, en el panel de
 *   resultados (`results/mechanism-explanation.tsx`).
 * - Las **advertencias conviven con los resultados**. Aparecen acá arriba y el
 *   panel de resultados sigue abajo, entero. Un aviso que tira los resultados
 *   abajo es un error disfrazado, que es lo que hacía el proyecto original.
 */
export function ErrorsPanel() {
  const [results] = useAtom(atomResults);

  if (results.status === "ok") return <GenericErrorsPanel issues={results.warnings} />;
  if (results.status !== "error") return null;

  return <GenericErrorsPanel issues={results.errors.filter((e) => !e.mechanism)} />;
}

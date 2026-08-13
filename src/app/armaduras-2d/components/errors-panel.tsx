"use client";

import { useAtom } from "jotai";

import { ErrorsPanel as GenericErrorsPanel } from "@/components/custom/errors-panel";
import { atomResults } from "../store/results";

/**
 * Solo las alertas de datos de entrada, que son las que se pueden atribuir a
 * una fila: por eso viven acá arriba, pegadas a las tablas que hay que
 * corregir.
 *
 * El error de mecanismo llega por la misma vía pero **se filtra**: no es un
 * dato mal cargado, es lo que produjo el cálculo, y encima no se puede
 * atribuir a ninguna fila (viaja con `refId: "-"`). Se muestra entero, con su
 * dibujo, en el panel de resultados (`results/mechanism-explanation.tsx`).
 */
export function ErrorsPanel() {
  const [results] = useAtom(atomResults);

  if (results.status !== "error") return null;

  return <GenericErrorsPanel errors={results.errors.filter((e) => !e.mechanism)} />;
}

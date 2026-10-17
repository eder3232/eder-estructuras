"use client";

import { useAtomValue } from "jotai";

import { ExcelExportButton as GenericExcelExportButton } from "@/components/custom/excel-export-button";
import { buildFrame2DWorkbook } from "@/lib/excel/frame-2d-workbook";
import { atomElements } from "../store/elements";
import { atomLoads } from "../store/loads";
import { atomNodes } from "../store/nodes";
import { atomResults } from "../store/results";

/**
 * El botón genérico, con el libro del pórtico: cargas en barras y FEM vivos
 * (ver `frame-2d-workbook.ts`). Sin imagen del esquema, por ahora: en un
 * pórtico lo que más dice el dibujo son las cargas, y esas se editan en el
 * libro, así que una imagen fija quedaría desactualizada en lo importante.
 */
export function ExcelExportButton() {
  const results = useAtomValue(atomResults);
  const nodes = useAtomValue(atomNodes);
  const elements = useAtomValue(atomElements);
  const loads = useAtomValue(atomLoads);

  return (
    <GenericExcelExportButton
      ready={results.status === "ok"}
      build={() => {
        if (results.status !== "ok") throw new Error("Hace falta un modelo que resuelva");
        return buildFrame2DWorkbook({ nodes, elements, loads, solved: results.solved });
      }}
      fileName="portico-2d.xlsx"
    />
  );
}

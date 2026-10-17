"use client";

import { useAtomValue } from "jotai";

import { ExcelExportButton as GenericExcelExportButton } from "@/components/custom/excel-export-button";
import { buildTruss3DWorkbook } from "@/lib/excel/truss-3d-workbook";
import { atomElements } from "../store/elements";
import { atomNodes } from "../store/nodes";
import { atomResults } from "../store/results";

/**
 * El botón genérico, con el libro de la armadura espacial. Sin imagen: los
 * nombres de la escena no están en el lienzo WebGL (ver `truss-3d-workbook.ts`).
 */
export function ExcelExportButton() {
  const results = useAtomValue(atomResults);
  const nodes = useAtomValue(atomNodes);
  const elements = useAtomValue(atomElements);

  return (
    <GenericExcelExportButton
      ready={results.status === "ok"}
      build={() => {
        if (results.status !== "ok") throw new Error("Hace falta un modelo que resuelva");
        return buildTruss3DWorkbook({ nodes, elements, solved: results.solved });
      }}
      fileName="armadura-3d.xlsx"
    />
  );
}

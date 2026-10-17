"use client";

import { useAtomValue } from "jotai";

import { ExcelExportButton as GenericExcelExportButton } from "@/components/custom/excel-export-button";
import { buildSeismicWorkbook } from "@/lib/excel/frame-2d-seismic-workbook";
import { atomSeismicWorkbookInput } from "../store/excel";

/**
 * El botón genérico, con el libro del sismo: Sismo, Rigidez lateral y
 * Combinaciones (ver `frame-2d-seismic-workbook.ts`). El procedimiento
 * matricial de cada caso es el del libro de Pórticos 2D y no se repite.
 */
export function ExcelExportButton() {
  const input = useAtomValue(atomSeismicWorkbookInput);
  return (
    <GenericExcelExportButton
      ready={input !== null}
      build={() => {
        if (!input) throw new Error("Hacen falta los tres casos resueltos y la rigidez lateral");
        return buildSeismicWorkbook(input);
      }}
      fileName="portico-sismo.xlsx"
    />
  );
}

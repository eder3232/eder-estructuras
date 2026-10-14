"use client";

import { useAtomValue } from "jotai";

import { ExcelExportButton as GenericExcelExportButton } from "@/components/custom/excel-export-button";
import { buildSpringsWorkbook } from "@/lib/excel/springs-workbook";
import { atomElements } from "../store/elements";
import { atomNodes } from "../store/nodes";
import { atomResults } from "../store/results";

/** El botón genérico, con el libro de resortes. Sin imagen: un sistema de resortes no tiene geometría. */
export function ExcelExportButton() {
  const results = useAtomValue(atomResults);
  const nodes = useAtomValue(atomNodes);
  const elements = useAtomValue(atomElements);

  return (
    <GenericExcelExportButton
      ready={results.status === "ok"}
      build={() => {
        if (results.status !== "ok") throw new Error("Hace falta un modelo que resuelva");
        return buildSpringsWorkbook({ nodes, elements, solved: results.solved });
      }}
      fileName="resortes.xlsx"
    />
  );
}

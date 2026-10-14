"use client";

import { useAtomValue } from "jotai";

import { schemaPng } from "@/components/custom/diagram-2d/schema-png";
import { ExcelExportButton as GenericExcelExportButton } from "@/components/custom/excel-export-button";
import { buildTruss2DWorkbook } from "@/lib/excel/truss-2d-workbook";
import { atomElements } from "../store/elements";
import { atomNodes } from "../store/nodes";
import { atomResults } from "../store/results";

/** El botón genérico, con el libro de armaduras y la imagen del esquema. */
export function ExcelExportButton() {
  const results = useAtomValue(atomResults);
  const nodes = useAtomValue(atomNodes);
  const elements = useAtomValue(atomElements);

  async function build() {
    if (results.status !== "ok") throw new Error("Hace falta un modelo que resuelva");
    // Con apoyos y sin cargas: los apoyos son fijos en el libro, así que el
    // dibujo no puede quedar desactualizado; las cargas se editan ahí.
    const supports = nodes
      .filter((n) => n.restrainedX || n.restrainedZ)
      .map((n) => ({ nodeId: n.id, x: n.x, z: n.z, restrainedX: n.restrainedX, restrainedZ: n.restrainedZ }));
    const schema = await schemaPng({ nodes, elements, supports });
    return buildTruss2DWorkbook({ nodes, elements, solved: results.solved, schema });
  }

  return <GenericExcelExportButton ready={results.status === "ok"} build={build} fileName="armadura-2d.xlsx" />;
}

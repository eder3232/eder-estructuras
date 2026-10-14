"use client";

import { useState } from "react";
import { useAtomValue } from "jotai";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { schemaPng } from "@/components/custom/diagram-2d/schema-png";
import { buildTruss2DWorkbook } from "@/lib/excel/truss-2d-workbook";
import { writeXlsx } from "@/lib/excel/write-xlsx";
import { atomElements } from "../store/elements";
import { atomNodes } from "../store/nodes";
import { atomResults } from "../store/results";

const FILE_NAME = "armadura-2d.xlsx";

/**
 * Descarga el modelo como un `.xlsx` con el método vivo (ver
 * `docs/excel-export.md`).
 *
 * **Solo se habilita con resultados.** El libro lleva al lado de cada fórmula
 * el número que dio el motor, y la partición sale de la solución: sin un
 * modelo que resuelva no hay libro que armar. El `title` dice por qué está
 * apagado, para que no parezca roto.
 */
export function ExcelExportButton() {
  const results = useAtomValue(atomResults);
  const nodes = useAtomValue(atomNodes);
  const elements = useAtomValue(atomElements);
  const [busy, setBusy] = useState(false);

  const ready = results.status === "ok";

  async function exportar() {
    if (results.status !== "ok") return;
    setBusy(true);
    try {
      // Con apoyos y sin cargas: los apoyos son fijos en el libro, así que el
      // dibujo no puede quedar desactualizado; las cargas se editan ahí.
      const supports = nodes
        .filter((n) => n.restrainedX || n.restrainedZ)
        .map((n) => ({ nodeId: n.id, x: n.x, z: n.z, restrainedX: n.restrainedX, restrainedZ: n.restrainedZ }));
      const schema = await schemaPng({ nodes, elements, supports });

      const workbook = buildTruss2DWorkbook({ nodes, elements, solved: results.solved, schema });
      const buffer = await writeXlsx(workbook);

      const url = URL.createObjectURL(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = FILE_NAME;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("No se pudo generar el Excel", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={exportar}
      disabled={!ready || busy}
      title={ready ? "Descargar un Excel donde el método se recalcula al editar los datos" : "Hace falta un modelo que resuelva"}
    >
      <FileSpreadsheet />
      {busy ? "Generando…" : "Descargar Excel"}
    </Button>
  );
}

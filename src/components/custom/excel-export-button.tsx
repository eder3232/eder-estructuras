"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { WorkbookModel } from "@/lib/excel/workbook-model";
import { writeXlsx } from "@/lib/excel/write-xlsx";

/**
 * Descarga el modelo como un `.xlsx` con el método vivo (ver
 * `docs/excel-export.md`). Genérico desde 2026-10-14: cada sistema dice cómo se
 * arma su libro (`build`), y esto lo escribe y lo descarga.
 *
 * **Solo se habilita con resultados.** El libro lleva al lado de cada fórmula
 * el número que dio el motor, y la partición sale de la solución: sin un
 * modelo que resuelva no hay libro que armar. El `title` dice por qué está
 * apagado, para que no parezca roto.
 */
export function ExcelExportButton({
  ready,
  build,
  fileName,
}: {
  ready: boolean;
  /** Arma el libro. Puede ser asíncrono (el de armaduras dibuja el esquema antes). */
  build: () => WorkbookModel | Promise<WorkbookModel>;
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);

  async function exportar() {
    if (!ready) return;
    setBusy(true);
    try {
      const buffer = await writeXlsx(await build());
      const url = URL.createObjectURL(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
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

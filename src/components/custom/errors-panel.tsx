import { AlertTriangle, Info } from "lucide-react";

import type { MechanismDiagnosis } from "@/lib/engine";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui-custom/alert";

/**
 * Algo que el modelo tiene para decir, con **dos severidades que no se mezclan**:
 *
 * - `error` — el motor no pudo calcular. No hay resultados.
 * - `warning` — el motor calculó igual, y hay algo que conviene saber.
 *
 * **La severidad no es cosmética: decide quién bloquea.** Un `warning` no puede
 * impedir que se muestren los resultados. Esa regla existe porque el proyecto
 * original hacía exactamente lo contrario —un aviso de severidad `warning`
 * viajaba en el mismo array que decidía si los resultados se rendían, así que
 * los hacía desaparecer— y está contada en `docs/errores.md`.
 */
export interface DomainIssue {
  source: "node" | "element" | "system";
  refId: string;
  message: string;
  severity: "error" | "warning";
  /**
   * Presente solo cuando el sistema no se pudo resolver porque la estructura es
   * un mecanismo. Lo dibuja el panel de resultados de cada sistema —hace falta
   * la geometría, que acá no está—; este componente solo lo transporta.
   */
  mechanism?: MechanismDiagnosis;
  /**
   * Nombre de la fila señalada, ya resuelto. Lo pone el adaptador de cada
   * sistema, porque el motor solo conoce ids y un id crudo en pantalla no le
   * dice nada a nadie.
   */
  refName?: string;
}

/** Un problema que impide calcular. Es el caso que ya existía. */
export type DomainError = DomainIssue & { severity: "error" };

const TITLE: Record<DomainIssue["source"], string> = {
  node: "nudo",
  element: "elemento",
  system: "modelo",
};

function titleOf(issue: DomainIssue) {
  const what = issue.refName ? `${TITLE[issue.source]} ${issue.refName}` : `un ${TITLE[issue.source]}`;
  return issue.severity === "error" ? `Error en ${what}` : `Revisá ${what}`;
}

/**
 * Presentación pura: cada sistema tiene su propio átomo de resultados, así que
 * el adaptador que lee ese átomo vive en `src/app/<sistema>/components/`, pero
 * el render es común a todos.
 */
export function ErrorsPanel({ issues }: { issues: DomainIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {issues.map((issue, i) => (
        <Alert key={i} variant={issue.severity === "error" ? "destructive" : "warning"}>
          {issue.severity === "error" ? <AlertTriangle /> : <Info />}
          <AlertTitle>{titleOf(issue)}</AlertTitle>
          <AlertDescription>{issue.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

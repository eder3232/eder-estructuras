"use client";

import { useState } from "react";

import { ErrorsPanel } from "@/app/frame2d/components/errors-panel";
import { ResultsPanel } from "@/app/frame2d/components/results-panel";
import { Frame2DViewProvider } from "@/app/frame2d/frame2d-view";
import { caseViews } from "../store/cases";
import { CASES, type CaseId } from "../store/model";
import { CaseSelector } from "./case-selector";

/**
 * El procedimiento entero de un caso —grados de libertad, ensamblaje,
 * partición, fuerzas internas, diagramas, deformada y equilibrio— con **los
 * mismos componentes de `/frame2d`**, alimentados por la vista de ese caso.
 */
export function CaseProcedure() {
  const [caseId, setCaseId] = useState<CaseId>("CS");
  const name = CASES.find((c) => c.id === caseId)!.name.toLowerCase();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-3xl flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Cada caso se resuelve <strong>una sola vez</strong>, con su carga y nada más. La matriz de rigidez es la
          misma en los tres —depende de la estructura, no de la carga—: lo único que cambia es el vector de fuerzas.
          Las combinaciones de más abajo no se resuelven: se suman.
        </p>
        <p>
          Con el <strong>diafragma rígido</strong>, los nudos de un piso comparten un solo grado de libertad
          horizontal, rotulado con el primer nudo del nivel: la matriz tiene una fila menos por cada nudo de más en
          el piso. Dos consecuencias que se ven en el procedimiento: <strong>las vigas del diafragma no se
          acortan, así que su fuerza axial da cero</strong> (la fuerza que reparte el piso la lleva el diafragma, y
          el equilibrio la muestra en su columna), y una fuerza horizontal en cualquier nudo del piso es la misma: se
          escribe en el primero.
        </p>
      </div>
      <CaseSelector value={caseId} onChange={setCaseId} label="Caso del procedimiento" />
      <Frame2DViewProvider value={caseViews[caseId]} key={caseId}>
        <ErrorsPanel />
        <ResultsPanel title={`Procedimiento del caso ${caseId} (${name})`} />
      </Frame2DViewProvider>
    </div>
  );
}

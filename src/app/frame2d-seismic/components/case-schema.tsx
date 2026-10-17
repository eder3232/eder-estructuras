"use client";

import { useState } from "react";

import { SchemaDiagram } from "@/app/frame2d/components/schema-diagram";
import { Frame2DViewProvider } from "@/app/frame2d/frame2d-view";
import { caseViews } from "../store/cases";
import type { CaseId } from "../store/model";
import { CaseSelector } from "./case-selector";

/**
 * El esquema **de un caso**. Con todas las cargas juntas, la muerta y la viva
 * de una misma viga se dibujaban una encima de la otra y se leía solo la
 * última (lo encontró mirar la app, paso 5). En CS se ven las Fᵢ de cada nivel.
 */
export function CaseSchema() {
  const [caseId, setCaseId] = useState<CaseId>("CM");
  return (
    <div className="flex flex-col gap-3">
      <CaseSelector value={caseId} onChange={setCaseId} label="Caso del esquema" />
      <Frame2DViewProvider value={caseViews[caseId]}>
        <SchemaDiagram />
      </Frame2DViewProvider>
    </div>
  );
}

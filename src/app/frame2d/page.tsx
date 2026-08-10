"use client";

import { DecimalsControl } from "@/components/custom/decimals-control";
import { ElementTable } from "./components/element-table";
import { ErrorsPanel } from "./components/errors-panel";
import { NodeTable } from "./components/node-table";
import { ResultsPanel } from "./components/results-panel";
import { SchemaDiagram } from "./components/schema-diagram";

export default function Frame2DPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">Pórticos 2D</h1>
        <p className="text-sm text-muted-foreground">
          Pórticos planos — 3 grados de libertad por nudo (x, z y giro). A diferencia de una armadura, cada barra
          resiste flexión además de fuerza axial, así que su rigidez depende del momento de inercia de la sección y no
          solo del área.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Nudos</h2>
        <NodeTable />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Barras</h2>
        <ElementTable />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Esquema</h2>
        <SchemaDiagram />
      </div>

      <ErrorsPanel />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Resultados</h2>
          <DecimalsControl />
        </div>
        <ResultsPanel />
      </div>
    </div>
  );
}

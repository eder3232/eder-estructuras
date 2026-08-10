"use client";

import { DecimalsControl } from "@/components/custom/decimals-control";
import { ElementTable } from "./components/element-table";
import { ErrorsPanel } from "./components/errors-panel";
import { NodeTable } from "./components/node-table";
import { ResultsPanel } from "./components/results-panel";
import { SchemaDiagram } from "./components/schema-diagram";

export default function Armaduras2DPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">Armaduras 2D</h1>
        <p className="text-sm text-muted-foreground">
          Sistema de armaduras planas — 2 grados de libertad por nudo (x, z), con transformación geométrica de la
          rigidez axial de cada barra según su ángulo.
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

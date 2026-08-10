"use client";

import { DecimalsControl } from "@/components/custom/decimals-control";
import { ElementTable } from "./components/element-table";
import { ErrorsPanel } from "./components/errors-panel";
import { NodeTable } from "./components/node-table";
import { ResultsPanel } from "./components/results-panel";
import { SchemaDiagram } from "./components/schema-diagram";

export default function Armaduras3DPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">Armaduras 3D</h1>
        <p className="text-sm text-muted-foreground">
          Armaduras espaciales — 3 grados de libertad por nudo (x, y, z), los tres de traslación. Cada barra sigue
          siendo solo axial: sus tres cosenos directores reparten esa única rigidez entre los 6 DOF de sus extremos.
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

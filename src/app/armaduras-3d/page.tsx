"use client";

import { HighlightProvider } from "@/components/custom/highlight";
import { UnitsNote } from "@/components/custom/units-note";
import { Classification } from "./components/classification";
import { ElementTable } from "./components/element-table";
import { ErrorsPanel } from "./components/errors-panel";
import { NodeTable } from "./components/node-table";
import { ResultsPanel } from "./components/results-panel";
import { SchemaDiagram } from "./components/schema-diagram";

export default function Armaduras3DPage() {
  return (
    // Tan ancha como `/armaduras-2d` (`max-w-[84rem]`), por la misma razón: las
    // matrices de una barra espacial son de 6×6 y no entran en `max-w-5xl`. La
    // prosa tiene techo propio. El proveedor de resaltado envuelve la página
    // porque el vínculo tabla ↔ escena (N3, paso 5) cruza las tablas de arriba
    // con la escena de abajo; hasta entonces no resalta nada.
    <HighlightProvider>
      <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-8 px-6 py-10">
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-bold">Armaduras 3D</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Armaduras espaciales — 3 grados de libertad por nudo (x, y, z), los tres de traslación. Cada barra sigue
              siendo solo axial: sus tres cosenos directores reparten esa única rigidez entre los 6 grados de libertad
              de sus extremos.
            </p>
          </div>
          <UnitsNote />
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

        {/* Entre el dibujo y el cálculo, porque es eso en el pizarrón. */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Clasificación</h2>
          <Classification />
        </div>

        <ErrorsPanel />

        <ResultsPanel />
      </div>
    </HighlightProvider>
  );
}

"use client";

import { HighlightProvider } from "@/components/custom/highlight";
import { UnitsNote } from "@/components/custom/units-note";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/use-hydrated";
import { Classification } from "./components/classification";
import { ElementTable } from "./components/element-table";
import { ErrorsPanel } from "./components/errors-panel";
import { ExamplesMenu, ModelPersistence, ResetModelButton } from "./components/model-persistence";
import { NodeTable } from "./components/node-table";
import { ResultsPanel } from "./components/results-panel";
import { SchemaDiagram } from "./components/schema-diagram";

/**
 * El lugar que va a ocupar algo que todavía no se puede dibujar. El modelo
 * vive en `localStorage`, que en el servidor no existe: hasta hidratar solo se
 * podría mostrar el ejemplo inicial, y verlo cambiar al modelo del alumno se lee
 * como «se perdió mi trabajo». Igual que en `/armaduras-2d`.
 */
function Reserved({ className }: { className: string }) {
  return <Skeleton className={`rounded-md ${className}`} aria-hidden />;
}

export default function Armaduras3DPage() {
  const hydrated = useHydrated();

  return (
    // Tan ancha como `/armaduras-2d` (`max-w-[84rem]`), por la misma razón: las
    // matrices de una barra espacial son de 6×6 y no entran en `max-w-5xl`. La
    // prosa tiene techo propio. El proveedor de resaltado envuelve la página
    // porque el vínculo tabla ↔ escena (N3) cruza las tablas de arriba con la
    // escena de abajo.
    <HighlightProvider>
      <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-8 px-6 py-10">
        {/* Guarda el modelo en cada cambio. No dibuja nada. */}
        <ModelPersistence />

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Armaduras 3D</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Armaduras espaciales — 3 grados de libertad por nudo (x, y, z), los tres de traslación. Cada barra
                sigue siendo solo axial: sus tres cosenos directores reparten esa única rigidez entre los 6 grados de
                libertad de sus extremos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ExamplesMenu />
              <ResetModelButton />
            </div>
          </div>
          <UnitsNote />
        </div>

        {/* Los títulos no dependen del modelo y se dibujan desde el primer
            cuadro: lo que espera es el contenido. */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Nudos</h2>
          {hydrated ? <NodeTable /> : <Reserved className="h-[25rem] w-full" />}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Barras</h2>
          {hydrated ? <ElementTable /> : <Reserved className="h-[32rem] w-full max-w-5xl" />}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Esquema</h2>
          {hydrated ? <SchemaDiagram /> : <Reserved className="h-[28rem] w-full" />}
        </div>

        {/* Entre el dibujo y el cálculo, porque es eso en el pizarrón. */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Clasificación</h2>
          {hydrated ? <Classification /> : <Reserved className="h-40 w-full max-w-3xl" />}
        </div>

        {hydrated && <ErrorsPanel />}

        {/* El título de Resultados vive adentro del panel; si el panel todavía no
            se dibuja, alguien tiene que ponerlo (la sección nunca desaparece). */}
        {hydrated ? (
          <ResultsPanel />
        ) : (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Resultados</h2>
            <Reserved className="h-96 w-full" />
          </div>
        )}
      </div>
    </HighlightProvider>
  );
}

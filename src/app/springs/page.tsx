"use client";

import { UnitsNote } from "@/components/custom/units-note";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/use-hydrated";
import { Classification } from "./components/classification";
import { ElementTable } from "./components/element-table";
import { ErrorsPanel } from "./components/errors-panel";
import { ExcelExportButton } from "./components/excel-export-button";
import { ExamplesMenu, ModelPersistence, ResetModelButton } from "./components/model-persistence";
import { NodeTable } from "./components/node-table";
import { ResultsPanel } from "./components/results-panel";

const strong = (text: string) => <span className="font-medium text-foreground">{text}</span>;

/**
 * El lugar que va a ocupar algo que todavía no se puede dibujar. El modelo
 * vive en `localStorage`, que en el servidor no existe: hasta hidratar solo se
 * podría mostrar el ejemplo inicial, y verlo cambiar al modelo del alumno se lee
 * como «se perdió mi trabajo». Igual que en `/armaduras-2d`.
 */
function Reserved({ className }: { className: string }) {
  return <Skeleton className={`rounded-md ${className}`} aria-hidden />;
}

export default function SpringsPage() {
  const hydrated = useHydrated();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      {/* Guarda el modelo en cada cambio. No dibuja nada. */}
      <ModelPersistence />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Resortes</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Sistema de resortes 1D — el caso más simple del método matricial de rigideces: 1 grado de libertad por
              nudo, sin geometría.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExamplesMenu />
            <ResetModelButton />
            {hydrated && <ExcelExportButton />}
          </div>
        </div>
        <UnitsNote
          example={
            <>
              Si trabajás en {strong("kN")} y {strong("mm")}: la rigidez <span className="italic">k</span> va en kN/mm,
              las cargas en kN y los desplazamientos prescritos en mm — y obtenés {strong("desplazamientos en mm")} y{" "}
              {strong("reacciones y fuerzas en los resortes en kN")}.
            </>
          }
          mixing={
            <>
              El error más común no es equivocarse de sistema: es <span className="font-medium">mezclar</span> — la{" "}
              <span className="italic">k</span> en kN/m con los desplazamientos prescritos en mm, por ejemplo. Eso da
              resultados errados por un factor de 1000 y {strong("el programa no puede detectarlo")}, porque para él
              son números válidos.
            </>
          }
        />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Nudos</h2>
        {hydrated ? <NodeTable /> : <Reserved className="h-[22rem] w-full" />}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Resortes</h2>
        {hydrated ? <ElementTable /> : <Reserved className="h-[18rem] w-full" />}
      </div>

      {/* Entre los datos y el cálculo, porque es eso en el pizarrón: se cuenta
          antes de armar K. En `/armaduras-2d` va después del esquema; acá no
          hay esquema. */}
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
  );
}

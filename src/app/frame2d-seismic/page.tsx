"use client";

import { useState } from "react";
import { Provider } from "jotai";

import { HighlightProvider } from "@/components/custom/highlight";
import { UnitsNote } from "@/components/custom/units-note";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/use-hydrated";
import { ElementTable } from "@/app/frame2d/components/element-table";
import { LoadTable } from "@/app/frame2d/components/load-table";
import { NodeTable } from "@/app/frame2d/components/node-table";
import { CaseSchema } from "./components/case-schema";
import { GRAVITY_CASES } from "./components/cases";
import { CombinationsTable } from "./components/combinations-table";
import { LevelsTable } from "./components/levels-table";
import { ModelPersistence, ResetModelButton } from "./components/model-persistence";
import { NodalLoadTable } from "./components/nodal-load-table";
import { SeismicParamsForm, SeismicSteps } from "./components/seismic-params";
import { createSeismicStore } from "./store/persistence";

/** El lugar de algo que todavía no se puede dibujar: el modelo vive en `localStorage` (ver `/frame2d`). */
function Reserved({ className }: { className: string }) {
  return <Skeleton className={`rounded-md ${className}`} aria-hidden />;
}

/**
 * Pórticos con análisis sísmico: `/frame2d` más casos de carga, la E.030, el
 * diafragma rígido, la rigidez lateral, las derivas y las combinaciones de la
 * E.060. Ver `docs/frame2d-seismic-v1.md`.
 *
 * **El `Provider` de Jotai no es decorativo**: las tablas del pórtico son las
 * de `/frame2d` y leen sus mismos átomos, y este store es el que hace que
 * editar acá no toque el pórtico de `/frame2d` (paso 3 del doc).
 */
export default function Frame2DSeismicPage() {
  const [store] = useState(() => createSeismicStore());
  return (
    <Provider store={store}>
      <SeismicPage />
    </Provider>
  );
}

function SeismicPage() {
  const hydrated = useHydrated();

  return (
    <HighlightProvider>
      <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-8 px-6 py-10">
        {hydrated && <ModelPersistence />}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Pórticos con análisis sísmico</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                El pórtico de <strong>Pórticos 2D</strong>, cargado por casos —muerta, viva y sismo— y resuelto una
                vez por caso. Del sismo se ocupa la <strong>E.030 (2026)</strong>: el cortante basal y su reparto en
                altura, el diafragma rígido de cada piso, la rigidez lateral y las derivas. Los casos se combinan con
                la <strong>E.060</strong> y de las combinaciones sale la envolvente para diseñar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ResetModelButton />
            </div>
          </div>
          <UnitsNote example={SEISMIC_EXAMPLE} mixing={SEISMIC_MIXING} />
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Nudos</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Geometría y apoyos. Las cargas en los nudos van por caso, más abajo.
          </p>
          {hydrated ? <NodeTable withLoads={false} /> : <Reserved className="h-[25rem] w-full" />}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Barras</h2>
          {hydrated ? <ElementTable /> : <Reserved className="h-[22rem] w-full" />}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Cargas en barras</h2>
          {hydrated ? <LoadTable cases={GRAVITY_CASES} /> : <Reserved className="h-[20rem] w-full" />}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Cargas en nudos</h2>
          {hydrated ? <NodalLoadTable /> : <Reserved className="h-40 w-full" />}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Esquema</h2>
          {hydrated ? <CaseSchema /> : <Reserved className="h-[34rem] w-full max-w-[500px]" />}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Sismo (E.030)</h2>
          {hydrated ? (
            <>
              <SeismicParamsForm />
              <h3 className="font-semibold">Niveles</h3>
              <LevelsTable />
              <h3 className="font-semibold">El cortante basal, paso a paso</h3>
              <SeismicSteps />
            </>
          ) : (
            <Reserved className="h-[36rem] w-full" />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Combinaciones de carga</h2>
          {hydrated ? <CombinationsTable /> : <Reserved className="h-80 w-full" />}
        </div>
      </div>
    </HighlightProvider>
  );
}

const strong = (text: string) => <span className="font-medium text-foreground">{text}</span>;

const SEISMIC_EXAMPLE = (
  <>
    Si trabajás en {strong("t")} y {strong("m")}: <span className="italic">E</span> en t/m², las coordenadas y las
    alturas en m, las cargas distribuidas en t/m, los pesos <span className="italic">Pᵢ</span> en t y{" "}
    <span className="italic">g</span> = 9.81 m/s² — y obtenés {strong("fuerzas sísmicas en t")} y{" "}
    {strong("desplazamientos en m")}.
  </>
);

const SEISMIC_MIXING = (
  <>
    Además de los clásicos de pórticos, acá hay uno propio: los <span className="italic">pesos</span> en kN con el
    módulo de elasticidad en t/m². El cortante sale en la unidad del peso y los desplazamientos en la del módulo:
    las derivas quedan erradas por un factor de 9.81, y {strong("el programa no puede detectarlo")}.
  </>
);

"use client";

import { HighlightProvider } from "@/components/custom/highlight";
import { UnitsNote } from "@/components/custom/units-note";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/use-hydrated";
import { ElementTable } from "./components/element-table";
import { ErrorsPanel } from "./components/errors-panel";
import { ExcelExportButton } from "./components/excel-export-button";
import { ExamplesMenu, ModelPersistence, ResetModelButton } from "./components/model-persistence";
import { NodeTable } from "./components/node-table";
import { ResultsPanel } from "./components/results-panel";
import { SchemaDiagram } from "./components/schema-diagram";

/**
 * El lugar que va a ocupar algo que todavía no se puede dibujar.
 *
 * No es un adorno de carga: el modelo vive en `localStorage`, que en el
 * servidor no existe, así que hasta que React hidrate lo único que se podría
 * mostrar es el ejemplo inicial — y si el alumno tiene su propio modelo
 * guardado, verlo aparecer y cambiar se lee como *se perdió mi trabajo*. Se
 * reserva el espacio y no se muestra un dato que no es suyo ni por un cuadro.
 */
function Reserved({ className }: { className: string }) {
  return <Skeleton className={`rounded-md ${className}`} aria-hidden />;
}

export default function Armaduras2DPage() {
  const hydrated = useHydrated();

  return (
    /*
      Esta página es **más ancha que las otras tres** (`max-w-5xl` → `84rem`), y
      la razón está medida, no estimada: la cadena `K = A · k · Aᵀ` de una barra
      son cuatro matrices en fila —16 columnas contando las de etiquetas— y pide
      unos 1220 px. En los 976 útiles de `max-w-5xl` **no entra a ninguna
      precisión que sirva**: con 2 decimales quedan 1190 y con fuente más chica
      1076, y bajar de 2 arruina los cosenos directores de `A`, que viven entre
      0 y 1. O sea que la salida "bajar los decimales de la sección" que estaba
      anotada para la deuda D10 no alcanzaba sola.

      Se ensancha la página entera y no el bloque de la ecuación por dos
      razones. Una es técnica: `AccordionContent` lleva `overflow-hidden` —lo
      necesita para animar la altura, y es de `ui/`, o sea intocable—, así que
      lo que se salga de su ancho queda recortado; el acordeón tiene que nacer
      ancho. La otra se vio en la captura del primer intento: sacando *solo* los
      resultados fuera de la columna, la página quedaba con dos bordes
      izquierdos distintos, que se lee peor que el scroll que se quería sacar.

      La prosa no se ensancha con la página: el párrafo de acá abajo y los del
      panel de resultados tienen techo propio. Ancho para los datos, medida de
      lectura para el texto.
    */
    // El proveedor de resaltado envuelve la página entera y no solo los
    // resultados: N3 va a querer que pasar el mouse por una fila de las tablas
    // de entrada encienda el nudo o la barra en el esquema, y esas tablas están
    // acá arriba.
    <HighlightProvider>
      <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-8 px-6 py-10">
        {/* Guarda el modelo en cada cambio. No dibuja nada. */}
        <ModelPersistence />

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Armaduras 2D</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Sistema de armaduras planas — 2 grados de libertad por nudo (x, z), con transformación geométrica de
                la rigidez axial de cada barra según su ángulo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ExamplesMenu />
              <ResetModelButton />
              {hydrated && <ExcelExportButton />}
            </div>
          </div>
          {/* Arriba de todo y no al lado de una tabla: la regla vale para lo que
              se carga **y** para lo que sale, así que no pertenece a ninguna de
              las dos mitades. */}
          <UnitsNote />
        </div>

        {/* Los títulos de sección no dependen del modelo, así que se dibujan
            desde el primer cuadro: lo que espera es el contenido. */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Nudos</h2>
          {hydrated ? <NodeTable /> : <Reserved className="h-[25rem] w-full max-w-5xl" />}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Barras</h2>
          {hydrated ? <ElementTable /> : <Reserved className="h-[32rem] w-full max-w-5xl" />}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Esquema</h2>
          {hydrated ? <SchemaDiagram /> : <Reserved className="h-80 w-80 md:h-[500px] md:w-[500px]" />}
        </div>

        {hydrated && <ErrorsPanel />}

        {/* El título y los controles de la sección viven adentro del panel: los
            controles dependen de si hay resultados y el título no. Por eso acá
            el título se repite: U3 fijó que la sección **nunca** desaparece, y
            si el panel no se dibuja todavía, alguien tiene que ponerlo. */}
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

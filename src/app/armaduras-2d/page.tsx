"use client";

import { ElementTable } from "./components/element-table";
import { ErrorsPanel } from "./components/errors-panel";
import { NodeTable } from "./components/node-table";
import { ResultsPanel } from "./components/results-panel";
import { SchemaDiagram } from "./components/schema-diagram";

export default function Armaduras2DPage() {
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
    <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">Armaduras 2D</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
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

      {/* El título y los controles de la sección viven adentro del panel: los
          controles dependen de si hay resultados y el título no. */}
      <ResultsPanel />
    </div>
  );
}

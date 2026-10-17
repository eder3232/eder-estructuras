"use client";

import { HighlightProvider } from "@/components/custom/highlight";
import { UnitsNote } from "@/components/custom/units-note";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/use-hydrated";
import { Classification } from "./components/classification";
import { ElementTable } from "./components/element-table";
import { ErrorsPanel } from "./components/errors-panel";
import { FemTable } from "./components/fem-table";
import { LoadTable } from "./components/load-table";
import { ExamplesMenu, ModelPersistence, ResetModelButton } from "./components/model-persistence";
import { NodeTable } from "./components/node-table";
import { ResultsPanel } from "./components/results-panel";
import { SchemaDiagram } from "./components/schema-diagram";

/**
 * El lugar que va a ocupar algo que todavía no se puede dibujar. El modelo
 * vive en `localStorage`, que en el servidor no existe: hasta hidratar solo se
 * podría mostrar el ejemplo inicial, y verlo cambiar al modelo del alumno se lee
 * como «se perdió mi trabajo». Igual que en los otros sistemas.
 */
function Reserved({ className }: { className: string }) {
  return <Skeleton className={`rounded-md ${className}`} aria-hidden />;
}

export default function Frame2DPage() {
  const hydrated = useHydrated();

  return (
    // Tan ancha como las otras tres (`max-w-[84rem]`): la tabla de cargas tiene
    // trece columnas y las matrices de una barra son de 6×6. La prosa tiene
    // techo propio. El proveedor de resaltado envuelve la página porque el
    // vínculo tabla ↔ esquema (N3) cruza las tablas de arriba con el dibujo.
    <HighlightProvider>
      <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-8 px-6 py-10">
        {/* Guarda el modelo en cada cambio. No dibuja nada. */}
        <ModelPersistence />

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Pórticos 2D</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Pórticos planos — 3 grados de libertad por nudo (x, z y giro). A diferencia de una armadura, cada barra
                resiste flexión además de fuerza axial, así que su rigidez depende del momento de inercia de la sección
                y no solo del área.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ExamplesMenu />
              <ResetModelButton />
            </div>
          </div>
          <UnitsNote example={FRAME_EXAMPLE} mixing={FRAME_MIXING} />
        </div>

        {/* Los títulos no dependen del modelo y se dibujan desde el primer
            cuadro: lo que espera es el contenido. */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Nudos</h2>
          {hydrated ? <NodeTable /> : <Reserved className="h-[25rem] w-full" />}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Barras</h2>
          {hydrated ? <ElementTable /> : <Reserved className="h-[22rem] w-full" />}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Cargas en barras</h2>
          {hydrated ? (
            <>
              <LoadTable />
              <h3 className="font-semibold">Momentos de empotramiento perfecto (FEM) por barra</h3>
              <FemTable />
            </>
          ) : (
            <Reserved className="h-[28rem] w-full" />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Esquema</h2>
          {hydrated ? <SchemaDiagram /> : <Reserved className="h-[32rem] w-full max-w-[500px]" />}
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

const strong = (text: string) => <span className="font-medium text-foreground">{text}</span>;

/** Un pórtico suma inercias, momentos y giros a lo que tiene una armadura: son los que se mezclan. */
const FRAME_EXAMPLE = (
  <>
    Si trabajás en {strong("tonf")} y {strong("m")}: <span className="italic">E</span> va en tonf/m², las coordenadas
    en m, el área en m², la inercia en m⁴, las cargas puntuales en tonf, las distribuidas en tonf/m y los momentos en
    tonf·m — y obtenés {strong("desplazamientos en m")}, {strong("giros en radianes")} y{" "}
    {strong("momentos en tonf·m")}.
  </>
);

const FRAME_MIXING = (
  <>
    El error más común no es equivocarse de sistema: es <span className="font-medium">mezclar</span>. En pórticos el
    clásico es la <span className="italic">inercia</span> en cm⁴ —como viene en las tablas de perfiles— con las
    coordenadas en metros: el error es de un factor de 10⁸, y {strong("el programa no puede detectarlo")}, porque
    para él son números válidos.
  </>
);

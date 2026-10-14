"use client";

import { useAtom } from "jotai";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CompactNumbersControl } from "@/components/custom/compact-numbers-control";
import { DecimalsControl } from "@/components/custom/decimals-control";
import { DecimalsScope } from "@/components/custom/decimals-scope";
import { SectionDecimals } from "@/components/custom/section-decimals";
import { DofOrderTable } from "@/components/custom/dof-order-table";
import { NoResults } from "@/components/custom/no-results";
import { atomElements, type ElementRow } from "../store/elements";
import { atomResults, type Armaduras2DResults } from "../store/results";
import { AssemblySteps } from "./results/assembly-steps";
import { DeformedShape } from "./results/deformed-shape";
import { DofOrderControl } from "./results/dof-order-control";
import { EquilibriumBadge, EquilibriumSection } from "./results/equilibrium-check";
import { GlobalEquation } from "./results/global-equation";
import { InternalForcesTable } from "./results/internal-forces-table";
import { LocalStiffnessList } from "./results/local-stiffness-list";
import { MechanismExplanation } from "./results/mechanism-explanation";
import { PartitionAndSolution } from "./results/partition-and-solution";
import { PracticeMode } from "./results/practice-mode";
import { UnitDisplacement } from "./results/unit-displacement";

const DOF_LABELS = ["x", "z"];

/**
 * La sección entera de resultados: el título, los controles y el cuerpo.
 *
 * El título vive acá y no en `page.tsx` porque los controles de al lado
 * **dependen del estado** —formatear números no significa nada cuando no hay
 * números— y el título no: la sección nunca desaparece. Que se fuera entera
 * haría saltar el layout justo cuando el usuario está corrigiendo el modelo,
 * que es el peor momento para mover las cosas de lugar.
 */
export function ResultsPanel() {
  const [results] = useAtom(atomResults);
  const [elements] = useAtom(atomElements);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Resultados</h2>
        {results.status === "ok" && (
          <div className="flex items-center gap-4">
            <CompactNumbersControl />
            <DecimalsControl />
          </div>
        )}
      </div>
      {results.status === "ok" ? (
        <SolvedResults results={results} elements={elements} />
      ) : (
        <WhyThereIsNothing results={results} elements={elements} />
      )}
    </div>
  );
}

/**
 * Por qué no hay resultados, que es lo único que la pantalla puede aportar
 * cuando no los hay. Un panel vacío obliga a adivinar si falta cargar algo o
 * si la app se rompió.
 */
function WhyThereIsNothing({
  results,
  elements,
}: {
  results: Exclude<Armaduras2DResults, { status: "ok" }>;
  elements: ElementRow[];
}) {
  if (results.status === "empty") {
    return (
      <NoResults tone="empty" title="Todavía no hay nada que calcular">
        {results.reason === "no-nodes" ? (
          <>El modelo necesita al menos un nudo y una barra. Agregá filas con el + de las tablas de arriba.</>
        ) : (
          <>
            Hay {results.nodeCount} {results.nodeCount === 1 ? "nudo" : "nudos"} pero ninguna barra, y sin barras no
            hay rigidez que ensamblar: cada nudo queda suelto, sin nada que se oponga a que se mueva.
          </>
        )}
      </NoResults>
    );
  }

  // Un error puede traer el diagnóstico **y** convivir con errores de datos;
  // el diagnóstico manda, porque es el que explica por qué se detuvo el
  // cálculo.
  const mechanism = results.errors.find((e) => e.mechanism)?.mechanism;
  if (mechanism) {
    return (
      <NoResults
        tone="error"
        title="El cálculo se detuvo: la estructura es un mecanismo"
        detail={<MechanismExplanation diagnosis={mechanism} nodesById={results.nodesById} elements={elements} />}
      />
    );
  }

  // Qué fila causó cada error, no el mensaje entero: ese está arriba, sobre la
  // tabla que hay que corregir, y repetirlo a 20 px de distancia no agrega nada.
  const nameOf = (error: (typeof results.errors)[number]) => {
    const name =
      error.source === "node"
        ? results.nodesById.get(error.refId)?.name
        : elements.find((e) => e.id === error.refId)?.name;
    return `${error.source === "node" ? "nudo" : "barra"} ${name ?? error.refId}`;
  };
  const rows = [...new Set(results.errors.map(nameOf))];

  return (
    <NoResults tone="error" title="No se pudo calcular">
      El modelo tiene {results.errors.length === 1 ? "un problema" : `${results.errors.length} problemas`} que
      {results.errors.length === 1 ? " impide" : " impiden"} armar el sistema
      {rows.length > 0 && <> ({rows.join(", ")})</>}. El detalle de cada uno está más arriba, en rojo.
    </NoResults>
  );
}

function SolvedResults({
  results,
  elements,
}: {
  results: Extract<Armaduras2DResults, { status: "ok" }>;
  elements: ElementRow[];
}) {
  const { solved, nodesById } = results;
  const { assembly } = solved;

  return (
    // El id de la raíz entra en la ruta de cada ámbito, así que la configuración
    // de un sistema no se pisa con la de otro que tenga los mismos bloques.
    //
    // `[&_p]:max-w-3xl` le pone techo a **toda** la prosa del panel de una sola
    // vez. Desde que la sección se ensancha para que entren las matrices (ver
    // `page.tsx`), un párrafo sin techo mediría 1300 px de renglón, que son unos
    // 180 caracteres: ilegible. Va acá y no párrafo por párrafo para que el que
    // agregue el próximo no tenga que acordarse.
    <DecimalsScope id="armaduras-2d">
      <div className="[&_p]:max-w-3xl">
        <Accordion type="multiple" defaultValue={["dof"]}>
          <AccordionItem value="dof">
            <AccordionTrigger>1. Grados de libertad y matrices locales</AccordionTrigger>
            <AccordionContent>
              <DecimalsScope id="local">
                <div className="flex flex-col gap-6">
                  <SectionDecimals />
                  {/* Las tablas de texto no aprovechan el ancho nuevo: son
                      `w-full` y estirarlas a 1350 px deja una columna de aire.
                      El techo las devuelve al ancho que tenían antes de que la
                      sección se ensanchara para las matrices. */}
                  <div className="flex max-w-5xl flex-col gap-3">
                    <DofOrderControl />
                    <DofOrderTable dofOrder={assembly.dofOrder} nodesById={nodesById} dofLabels={DOF_LABELS} />
                  </div>
                  <LocalStiffnessList elements={elements} nodesById={nodesById} />
                  <PracticeMode elements={elements} nodesById={nodesById} assembly={assembly} />
                </div>
              </DecimalsScope>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="assembly">
            <AccordionTrigger>2. Ensamblaje de la matriz global</AccordionTrigger>
            <AccordionContent>
              <DecimalsScope id="assembly">
                <div className="flex flex-col gap-6">
                  <SectionDecimals />
                  <AssemblySteps
                    steps={assembly.steps}
                    dofOrder={assembly.dofOrder}
                    elements={elements}
                    nodesById={nodesById}
                  />
                  <GlobalEquation assembly={assembly} solved={solved} nodesById={nodesById} elements={elements} />
                  <UnitDisplacement elements={elements} nodesById={nodesById} assembly={assembly} />
                </div>
              </DecimalsScope>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="partition">
            <AccordionTrigger>3. Partición y solución</AccordionTrigger>
            <AccordionContent>
              <DecimalsScope id="partition">
                <div className="flex flex-col gap-6">
                  <SectionDecimals />
                  <PartitionAndSolution assembly={assembly} solved={solved} nodesById={nodesById} />
                </div>
              </DecimalsScope>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="internal">
            <AccordionTrigger>4. Fuerzas internas</AccordionTrigger>
            <AccordionContent>
              <DecimalsScope id="internal">
                <div className="flex flex-col gap-6">
                  <SectionDecimals />
                  <div className="max-w-5xl">
                    <InternalForcesTable
                      elements={elements}
                      internalForces={solved.internalForces}
                      displacements={solved.displacements}
                      nodesById={nodesById}
                    />
                  </div>
                </div>
              </DecimalsScope>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="deformed">
            <AccordionTrigger>5. Forma deformada</AccordionTrigger>
            <AccordionContent>
              <DecimalsScope id="deformed">
                <div className="flex flex-col gap-6">
                  <SectionDecimals label="Decimales de las etiquetas:" hint={false} />
                  <DeformedShape elements={elements} nodesById={nodesById} solved={solved} />
                </div>
              </DecimalsScope>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="equilibrium">
            {/* El veredicto va en el título y no adentro: la pregunta "¿puedo
                confiar en esto?" se tiene que poder contestar sin desplegar
                nada. La cuenta, que es lo que enseña, está adentro. */}
            <AccordionTrigger>
              <span className="flex flex-wrap items-center gap-3">
                6. Verificación de equilibrio
                <EquilibriumBadge equilibrium={solved.equilibrium} />
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <DecimalsScope id="equilibrium">
                <div className="flex max-w-5xl flex-col gap-6">
                  <SectionDecimals />
                  <EquilibriumSection equilibrium={solved.equilibrium} nodesById={nodesById} />
                </div>
              </DecimalsScope>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </DecimalsScope>
  );
}

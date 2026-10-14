"use client";

import { useAtom, useSetAtom } from "jotai";

import type { DofOrderEntry } from "@/lib/engine";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui-custom/accordion";
import { CompactNumbersControl } from "@/components/custom/compact-numbers-control";
import { DecimalsControl } from "@/components/custom/decimals-control";
import { DecimalsScope } from "@/components/custom/decimals-scope";
import { DofOrderControl } from "@/components/custom/dof-order-control";
import { DofOrderTable } from "@/components/custom/dof-order-table";
import { EquilibriumBadge, EquilibriumSection } from "@/components/custom/equilibrium-section";
import { GlobalEquation } from "@/components/custom/global-equation";
import { Math } from "@/components/custom/math";
import { NoResults } from "@/components/custom/no-results";
import { PartitionAndSolution } from "@/components/custom/partition-and-solution";
import { SectionDecimals } from "@/components/custom/section-decimals";
import { atomRestrainedFirst, atomToggleRestrainedFirst, atomUseDofNumbers } from "../store/dof-order";
import { atomElements, type ElementRow } from "../store/elements";
import { atomResults, type SpringsResults } from "../store/results";
import { AssemblySteps } from "./results/assembly-steps";
import { InternalForcesTable } from "./results/internal-forces-table";
import { LocalStiffnessList } from "./results/local-stiffness-list";
import { MechanismExplanation } from "./results/mechanism-explanation";
import { PracticeMode } from "./results/practice-mode";

/**
 * La sección entera de resultados, con el mismo contrato que `/armaduras-2d`:
 * el título nunca desaparece (moverlo justo cuando el alumno corrige el modelo
 * es el peor momento), los controles de formato solo aparecen cuando hay
 * números, y si no hay resultados se dice por qué.
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

/** Por qué no hay resultados. Un panel vacío obliga a adivinar si falta cargar algo o si la app se rompió. */
function WhyThereIsNothing({
  results,
  elements,
}: {
  results: Exclude<SpringsResults, { status: "ok" }>;
  elements: ElementRow[];
}) {
  if (results.status === "empty") {
    return (
      <NoResults tone="empty" title="Todavía no hay nada que calcular">
        {results.reason === "no-nodes" ? (
          <>El modelo necesita al menos un nudo y un resorte. Agregá filas con el + de las tablas de arriba.</>
        ) : (
          <>
            Hay {results.nodeCount} {results.nodeCount === 1 ? "nudo" : "nudos"} pero ningún resorte, y sin resortes no
            hay rigidez que ensamblar: cada nudo queda suelto, sin nada que se oponga a que se mueva.
          </>
        )}
      </NoResults>
    );
  }

  const mechanism = results.errors.find((e) => e.mechanism)?.mechanism;
  if (mechanism) {
    return (
      <NoResults
        tone="error"
        title="El cálculo se detuvo: el sistema es un mecanismo"
        detail={<MechanismExplanation diagnosis={mechanism} nodesById={results.nodesById} />}
      />
    );
  }

  // Qué fila causó cada error, no el mensaje entero: ese está arriba, sobre la
  // tabla que hay que corregir.
  const rows = [
    ...new Set(
      results.errors.map((error) =>
        error.source === "node"
          ? `nudo ${results.nodesById.get(error.refId)?.name ?? error.refName ?? "?"}`
          : `resorte ${elements.find((e) => e.id === error.refId)?.name ?? error.refName ?? "?"}`,
      ),
    ),
  ];

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
  results: Extract<SpringsResults, { status: "ok" }>;
  elements: ElementRow[];
}) {
  const { solved, nodesById } = results;
  const { assembly } = solved;
  const [restrainedFirst] = useAtom(atomRestrainedFirst);
  const [useDofNumbers] = useAtom(atomUseDofNumbers);
  const toggleRestrainedFirst = useSetAtom(atomToggleRestrainedFirst);
  // Un grado de libertad por nudo: el rótulo es el nombre del nudo, sin eje.
  const labelOf = (entry: DofOrderEntry) => nodesById.get(entry.nodeId)?.name ?? entry.nodeId;
  const forceOf = (entry: DofOrderEntry) => nodesById.get(entry.nodeId)!.force;

  return (
    // El id de la raíz entra en la ruta de cada ámbito de decimales, así que la
    // configuración de este sistema no se pisa con la de otro. `[&_p]:max-w-3xl`
    // le pone techo a toda la prosa del panel de una vez.
    <DecimalsScope id="springs">
      <div className="[&_p]:max-w-3xl">
        <Accordion type="multiple" defaultValue={["dof"]}>
          <AccordionItem value="dof">
            <AccordionTrigger>1. Grados de libertad y matrices locales</AccordionTrigger>
            <AccordionContent>
              <DecimalsScope id="local">
                <div className="flex flex-col gap-6">
                  <SectionDecimals />
                  <div className="flex max-w-5xl flex-col gap-3">
                    <DofOrderControl
                      restrainedFirst={restrainedFirst}
                      useDofNumbers={useDofNumbers}
                      onToggle={toggleRestrainedFirst}
                    />
                    <DofOrderTable dofOrder={assembly.dofOrder} nodesById={nodesById} />
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
                  <GlobalEquation assembly={assembly} solved={solved} labelOf={labelOf} forceOf={forceOf} />
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
                  <PartitionAndSolution
                    assembly={assembly}
                    solved={solved}
                    labelOf={labelOf}
                    forceOf={forceOf}
                    displacementOf={(entry) => nodesById.get(entry.nodeId)!.displacement}
                  />
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

          <AccordionItem value="equilibrium">
            {/* El veredicto va en el título: «¿puedo confiar en esto?» se
                contesta sin desplegar nada. */}
            <AccordionTrigger>
              <span className="flex flex-wrap items-center gap-3">
                5. Verificación de equilibrio
                <EquilibriumBadge equilibrium={solved.equilibrium} />
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <DecimalsScope id="equilibrium">
                <div className="flex max-w-5xl flex-col gap-6">
                  <SectionDecimals />
                  <EquilibriumSection
                    equilibrium={solved.equilibrium}
                    nodeName={(id) => nodesById.get(id)?.name ?? id}
                    axes={["Fuerza"]}
                    vocabulary={{ one: "resorte", many: "resortes", the: "los" }}
                    equation="\sum F = 0 \qquad \text{en cada nudo}"
                    howElementsPull={
                      <>
                        Cada resorte hace sobre sus nudos su fuerza interna <Math tex="F = k\,\Delta" /> (la de la
                        sección 4), y apunta <span className="font-medium text-foreground">hacia la otra punta</span>:
                        un resorte estirado tira de sus dos nudos hacia adentro, uno comprimido los empuja hacia afuera.
                      </>
                    }
                  />
                </div>
              </DecimalsScope>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </DecimalsScope>
  );
}

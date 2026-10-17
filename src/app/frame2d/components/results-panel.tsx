"use client";

import { useAtom } from "jotai";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CompactNumbersControl } from "@/components/custom/compact-numbers-control";
import { DecimalsControl } from "@/components/custom/decimals-control";
import { DofOrderTable } from "@/components/custom/dof-order-table";
import { NoResults } from "@/components/custom/no-results";
import { atomElements, type ElementRow } from "../store/elements";
import { atomResults, type Frame2DResults } from "../store/results";
import { dofLabels } from "../store/nodes";
import { AssemblySteps } from "./results/assembly-steps";
import { DeformedShape } from "./results/deformed-shape";
import { InternalForcesTable } from "./results/internal-forces-table";
import { LocalStiffnessList } from "./results/local-stiffness-list";
import { MechanismExplanation } from "./results/mechanism-explanation";
import { MemberDiagrams } from "./results/member-diagrams";
import { PartitionAndSolution } from "./results/partition-and-solution";

/**
 * La sección entera de resultados, con la forma de `/armaduras-2d`: el título
 * vive acá porque la sección nunca desaparece, y los controles de al lado
 * dependen de que haya números.
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

/** Por qué no hay resultados (U3): un panel vacío obliga a adivinar si falta algo o si la app se rompió. */
function WhyThereIsNothing({
  results,
  elements,
}: {
  results: Exclude<Frame2DResults, { status: "ok" }>;
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

  const mechanism = results.errors.find((e) => e.mechanism)?.mechanism;
  if (mechanism) {
    return (
      <NoResults
        tone="error"
        title="El cálculo se detuvo: la estructura es un mecanismo"
        detail={<MechanismExplanation diagnosis={mechanism} nodesById={results.nodesById} />}
      />
    );
  }

  // Qué fila causó cada error, no el mensaje entero: ese está arriba, sobre la
  // tabla que hay que corregir.
  const nameOf = (error: (typeof results.errors)[number]) => {
    if (error.source === "load") return `carga ${error.refName ?? error.refId}`;
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
  results: Extract<Frame2DResults, { status: "ok" }>;
  elements: ElementRow[];
}) {
  const { solved, nodesById } = results;
  const { assembly } = solved;

  return (
    // Techo a toda la prosa del panel: la página es ancha para las matrices,
    // no para los renglones (ver `/armaduras-2d`).
    <div className="[&_p]:max-w-3xl">
      <Accordion type="multiple" defaultValue={["dof"]}>
        <AccordionItem value="dof">
          <AccordionTrigger>1. Grados de libertad y matrices locales</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-6">
            <DofOrderTable dofOrder={assembly.dofOrder} nodesById={nodesById} dofLabels={dofLabels} />
            <LocalStiffnessList elements={elements} nodesById={nodesById} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="assembly">
          <AccordionTrigger>2. Ensamblaje de la matriz global</AccordionTrigger>
          <AccordionContent>
            <AssemblySteps steps={assembly.steps} dofOrder={assembly.dofOrder} elements={elements} nodesById={nodesById} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="partition">
          <AccordionTrigger>3. Partición y solución</AccordionTrigger>
          <AccordionContent>
            <PartitionAndSolution assembly={assembly} solved={solved} nodesById={nodesById} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="internal">
          <AccordionTrigger>4. Fuerzas internas</AccordionTrigger>
          <AccordionContent>
            <InternalForcesTable
              elements={elements}
              internalForces={solved.internalForces}
              displacements={solved.displacements}
              nodesById={nodesById}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="diagrams">
          <AccordionTrigger>5. Diagramas de fuerza axial, cortante y momento</AccordionTrigger>
          <AccordionContent>
            <MemberDiagrams elements={elements} nodesById={nodesById} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="deformed">
          <AccordionTrigger>6. Forma deformada</AccordionTrigger>
          <AccordionContent>
            <DeformedShape elements={elements} nodesById={nodesById} solved={solved} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

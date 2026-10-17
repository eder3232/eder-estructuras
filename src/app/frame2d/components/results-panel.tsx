"use client";

import type { ReactNode } from "react";
import { useAtom } from "jotai";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui-custom/accordion";
import { CompactNumbersControl } from "@/components/custom/compact-numbers-control";
import { DecimalsControl } from "@/components/custom/decimals-control";
import { DecimalsScope } from "@/components/custom/decimals-scope";
import { DofOrderTable } from "@/components/custom/dof-order-table";
import { SectionDecimals } from "@/components/custom/section-decimals";
import { NoResults } from "@/components/custom/no-results";
import { atomElements, type ElementRow } from "../store/elements";
import { atomResults, type Frame2DResults } from "../store/results";
import { dofLabels } from "../store/nodes";
import { AssemblySteps } from "./results/assembly-steps";
import { DeformedShape } from "./results/deformed-shape";
import { DofOrderControl } from "./results/dof-order-control";
import { EquilibriumBadge, EquilibriumSection } from "./results/equilibrium-check";
import { GlobalEquation } from "./results/global-equation";
import { PracticeMode } from "./results/practice-mode";
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
        detail={<MechanismExplanation diagnosis={mechanism} nodesById={results.nodesById} elements={elements} />}
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

  /** Una sección del acordeón con su propio alcance de decimales (D8): página → sección → tabla. */
  const section = (id: string, title: ReactNode, body: ReactNode, label?: string) => (
    <AccordionItem value={id}>
      <AccordionTrigger>{title}</AccordionTrigger>
      <AccordionContent>
        <DecimalsScope id={id}>
          <div className="flex flex-col gap-6">
            {label ? <SectionDecimals label={label} hint={false} /> : <SectionDecimals />}
            {body}
          </div>
        </DecimalsScope>
      </AccordionContent>
    </AccordionItem>
  );

  return (
    // Techo a toda la prosa del panel: la página es ancha para las matrices,
    // no para los renglones (ver `/armaduras-2d`).
    <DecimalsScope id="frame2d">
      <div className="[&_p]:max-w-3xl">
        <Accordion type="multiple" defaultValue={["dof"]}>
          {section(
            "dof",
            "1. Grados de libertad y matrices locales",
            <>
              <div className="flex max-w-5xl flex-col gap-3">
                <DofOrderControl />
                <DofOrderTable dofOrder={assembly.dofOrder} nodesById={nodesById} dofLabels={dofLabels} />
              </div>
              <LocalStiffnessList elements={elements} nodesById={nodesById} />
              <PracticeMode elements={elements} nodesById={nodesById} assembly={assembly} />
            </>,
          )}
          {section(
            "assembly",
            "2. Ensamblaje de la matriz global",
            <>
              <AssemblySteps steps={assembly.steps} dofOrder={assembly.dofOrder} elements={elements} nodesById={nodesById} />
              <GlobalEquation assembly={assembly} solved={solved} nodesById={nodesById} />
            </>,
          )}
          {section("partition", "3. Partición y solución", <PartitionAndSolution assembly={assembly} solved={solved} nodesById={nodesById} />)}
          {section(
            "internal",
            "4. Fuerzas internas",
            <InternalForcesTable
              elements={elements}
              internalForces={solved.internalForces}
              displacements={solved.displacements}
              nodesById={nodesById}
            />,
          )}
          {section(
            "diagrams",
            "5. Diagramas de fuerza axial, cortante y momento",
            <MemberDiagrams elements={elements} nodesById={nodesById} />,
            "Decimales de las etiquetas:",
          )}
          {section(
            "deformed",
            "6. Forma deformada",
            <DeformedShape elements={elements} nodesById={nodesById} solved={solved} />,
            "Decimales de las etiquetas:",
          )}
          {section(
            "equilibrium",
            // El veredicto en el título: "¿puedo confiar en esto?" se contesta sin desplegar nada.
            <span className="flex flex-wrap items-center gap-3">
              7. Verificación de equilibrio
              <EquilibriumBadge equilibrium={solved.equilibrium} />
            </span>,
            // Sin el tope de `max-w-5xl` de las armaduras: con tres componentes
            // por nudo son 13 columnas numéricas y la de la suma quedaba tapada.
            <EquilibriumSection equilibrium={solved.equilibrium} nodesById={nodesById} />,
          )}
        </Accordion>
      </div>
    </DecimalsScope>
  );
}

"use client";

import { useAtom } from "jotai";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { atomElements } from "../store/elements";
import { atomResults } from "../store/results";
import { DofOrderTable } from "@/components/custom/dof-order-table";
import { AssemblySteps } from "./results/assembly-steps";
import { InternalForcesTable } from "./results/internal-forces-table";
import { LocalStiffnessList } from "./results/local-stiffness-list";
import { PartitionAndSolution } from "./results/partition-and-solution";

export function ResultsPanel() {
  const [results] = useAtom(atomResults);
  const [elements] = useAtom(atomElements);

  if (results.status !== "ok") return null;

  const { solved, nodesById } = results;
  const { assembly } = solved;

  return (
    <Accordion type="multiple" defaultValue={["dof"]}>
      <AccordionItem value="dof">
        <AccordionTrigger>1. Grados de libertad y matrices locales</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-6">
          <DofOrderTable dofOrder={assembly.dofOrder} nodesById={nodesById} />
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
    </Accordion>
  );
}

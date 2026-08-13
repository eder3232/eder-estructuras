"use client";

import { useAtom } from "jotai";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DecimalsScope, ScopeDecimalsControl } from "@/components/custom/decimals-scope";
import { DofOrderTable } from "@/components/custom/dof-order-table";
import { atomElements } from "../store/elements";
import { atomResults } from "../store/results";
import { AssemblySteps } from "./results/assembly-steps";
import { DeformedShape } from "./results/deformed-shape";
import { GlobalEquation } from "./results/global-equation";
import { InternalForcesTable } from "./results/internal-forces-table";
import { LocalStiffnessList } from "./results/local-stiffness-list";
import { PartitionAndSolution } from "./results/partition-and-solution";

const DOF_LABELS = ["x", "z"];

/**
 * Encabezado de precisión de una sección. La leyenda va una sola vez por
 * bloque, y no repetida en cada tabla: explicar la cascada veintipico de veces
 * era justamente lo que hacía ilegible la pantalla.
 */
function SectionDecimals({
  label = "Decimales de esta sección:",
  hint = true,
}: {
  label?: string;
  hint?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <ScopeDecimalsControl label={label} inheritsFrom="la página" />
      {hint && (
        <p className="text-xs text-muted-foreground">
          Cada tabla sigue a la sección salvo que le fijes un número con − / +. El ↺ la vuelve a soltar.
        </p>
      )}
    </div>
  );
}

export function ResultsPanel() {
  const [results] = useAtom(atomResults);
  const [elements] = useAtom(atomElements);

  if (results.status !== "ok") return null;

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
                  <div className="max-w-5xl">
                    <DofOrderTable dofOrder={assembly.dofOrder} nodesById={nodesById} dofLabels={DOF_LABELS} />
                  </div>
                  <LocalStiffnessList elements={elements} nodesById={nodesById} />
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
                  <GlobalEquation assembly={assembly} solved={solved} nodesById={nodesById} />
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
        </Accordion>
      </div>
    </DecimalsScope>
  );
}

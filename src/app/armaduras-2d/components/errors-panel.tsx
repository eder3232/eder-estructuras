"use client";

import { useAtom } from "jotai";

import type { MechanismDiagnosis } from "@/lib/engine";
import { ErrorsPanel as GenericErrorsPanel } from "@/components/custom/errors-panel";
import { DeformedDiagram } from "@/components/custom/diagram-2d/deformed-diagram";
import { atomElements } from "../store/elements";
import { atomResults } from "../store/results";
import type { NodeRow } from "../store/nodes";

const AXIS_LABEL = ["x", "z"];

export function ErrorsPanel() {
  const [results] = useAtom(atomResults);
  const [elements] = useAtom(atomElements);

  if (results.status !== "error") return null;

  const mechanism = results.errors.find((e) => e.mechanism)?.mechanism;

  return (
    <div className="flex flex-col gap-4">
      <GenericErrorsPanel errors={results.errors} />
      {mechanism && (
        <MechanismExplanation
          diagnosis={mechanism}
          nodesById={results.nodesById}
          elements={elements}
        />
      )}
    </div>
  );
}

/**
 * El error más común del principiante, convertido en la lección que tiene
 * adentro.
 *
 * Que la matriz no se pueda invertir significa que la estructura **puede
 * moverse sin deformarse**: eso no es un problema numérico, es el momento en
 * que se entiende para qué sirven los apoyos. Así que en vez de un mensaje se
 * muestra el movimiento — el modo de cuerpo rígido, dibujado.
 */
function MechanismExplanation({
  diagnosis,
  nodesById,
  elements,
}: {
  diagnosis: MechanismDiagnosis;
  nodesById: Map<string, NodeRow>;
  elements: { id: string; name: string; fromNodeId: string; toNodeId: string }[];
}) {
  const nodes = [...nodesById.values()];
  const nameOf = (nodeId: string) => nodesById.get(nodeId)?.name ?? nodeId;

  const displacements = new Map<string, [number, number]>(nodes.map((n) => [n.id, [0, 0]]));
  for (const dof of diagnosis.mode ?? []) {
    const vector = displacements.get(dof.nodeId);
    if (vector) vector[dof.localDof] = dof.value;
  }

  // Solo las barras que conectan nudos que existen: si el modelo está a medio
  // cargar, el resto del panel ya lo está diciendo.
  const drawable = elements.filter((e) => nodesById.has(e.fromNodeId) && nodesById.has(e.toNodeId));

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed p-4">
      <div className="flex flex-col gap-2 text-sm">
        <p className="font-medium">Qué significa esto</p>
        <p className="max-w-3xl text-muted-foreground">
          Una estructura se resuelve cuando cada movimiento posible encuentra algo que se le oponga. Acá hay al menos
          uno que no: la estructura puede moverse <span className="font-medium text-foreground">sin deformar
          ninguna barra</span>, y un movimiento que no estira nada no necesita fuerza. Por eso el sistema no tiene una
          solución única — no es un problema de números, es que falta sujetar algo.
        </p>
        {diagnosis.loose.length > 0 && (
          <p className="max-w-3xl text-muted-foreground">
            Sin nada que lo sostenga:{" "}
            <span className="font-medium text-foreground">
              {diagnosis.loose.map((dof) => `${nameOf(dof.nodeId)} en ${AXIS_LABEL[dof.localDof]}`).join(", ")}
            </span>
            . Una barra de armadura solo tiene rigidez <span className="italic">sobre su propio eje</span>, así que un
            nudo al que solo llegan barras paralelas queda libre en la dirección perpendicular, aunque tenga barras.
          </p>
        )}
      </div>

      {diagnosis.mode && (
        <DeformedDiagram
          nodes={nodes}
          elements={drawable}
          displacements={displacements}
          reactions={[]}
          elementForceValue={new Map()}
          scale={{ initial: 0.5, max: 2, step: 0.1 }}
          showZeroAxialLabels={false}
          legend={
            <>
              Línea punteada: la estructura como está. Línea sólida: así se puede mover, sin que ninguna barra cambie
              de longitud. Mové el factor de escala para verlo mejor.
            </>
          }
        />
      )}
    </div>
  );
}

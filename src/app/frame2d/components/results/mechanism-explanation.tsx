"use client";

import Link from "next/link";
import { useAtomValue } from "jotai";

import { loadCompatibility, type MechanismDiagnosis } from "@/lib/engine";
import { DeformedDiagram } from "@/components/custom/diagram-2d/deformed-diagram";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";
import { atomMemberLoads } from "../../store/results";

/** Por debajo de esto, la componente del modo se considera cero: ese nudo no se mueve. */
const MOVES = 1e-9;
const AXES = ["x", "z", "θ"];

/**
 * El diagnóstico de mecanismo de un pórtico: en palabras, **dibujado**, y con
 * lo que pasa con esta carga (la alternativa de Fredholm), como en
 * `/armaduras-2d`.
 *
 * En un pórtico el caso típico **no** es el de las armaduras: una barra de
 * pórtico resiste también flexión, así que un nudo con barras rara vez queda
 * suelto. Lo que falta casi siempre es un apoyo —el pórtico entero se traslada
 * o gira—.
 *
 * El movimiento se dibuja con las barras **rectas**, y es exacto: un movimiento
 * que no deforma ninguna barra las mueve como cuerpos rígidos, así que cada una
 * se traslada y gira sin curvarse.
 */
export function MechanismExplanation({
  diagnosis,
  nodesById,
  elements,
}: {
  diagnosis: MechanismDiagnosis;
  nodesById: Map<string, NodeRow>;
  elements: ElementRow[];
}) {
  const nodes = [...nodesById.values()];
  const nameOf = (nodeId: string) => nodesById.get(nodeId)?.name ?? nodeId;
  const loose = diagnosis.loose.map((dof) => `${nameOf(dof.nodeId)} en ${AXES[dof.localDof]}`);
  const looseNodes = new Set(diagnosis.loose.map((dof) => dof.nodeId));
  const moving = [
    ...new Set(
      (diagnosis.mode ?? [])
        .filter((dof) => Math.abs(dof.value) > MOVES && !looseNodes.has(dof.nodeId))
        .map((dof) => nameOf(dof.nodeId)),
    ),
  ];

  const displacements = new Map<string, [number, number]>(nodes.map((n) => [n.id, [0, 0]]));
  for (const dof of diagnosis.mode ?? []) {
    const vector = displacements.get(dof.nodeId);
    // El giro no mueve el nudo: se ve en cómo se inclinan las barras.
    if (vector && dof.localDof < 2) vector[dof.localDof] = dof.value;
  }
  const drawable = elements.filter((e) => nodesById.has(e.fromNodeId) && nodesById.has(e.toNodeId));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 text-sm">
        <p className="max-w-3xl text-muted-foreground">
          Una estructura se resuelve cuando cada movimiento posible encuentra algo que se le oponga. Acá hay al menos
          uno que no: una parte puede moverse{" "}
          <span className="font-medium text-foreground">sin estirar ni flexionar ninguna barra</span>, y un movimiento
          que no deforma nada no necesita fuerza. Por eso no hay una solución única — no es un problema de números,
          es que falta sujetar algo.
        </p>
        {loose.length > 0 && (
          <p className="max-w-3xl text-muted-foreground">
            Sin ninguna barra que lo frene: <span className="font-medium text-foreground">{loose.join(", ")}</span>.
            Su fila de la matriz es toda de ceros: a ese nudo no llega ninguna barra que resista en esa dirección.
          </p>
        )}
        {moving.length > 0 && (
          <p className="max-w-3xl text-muted-foreground">
            {moving.length === 1 ? "Se mueve" : "Se mueven juntos"}, sin deformar ninguna barra:{" "}
            <span className="font-medium text-foreground">{moving.join(", ")}</span>. En el plano hay tres
            movimientos de cuerpo rígido —dos traslaciones y un giro— y los apoyos tienen que frenar los tres; lo más
            común es que falte frenar el desplazamiento horizontal.
          </p>
        )}
      </div>

      {diagnosis.mode && <Fredholm mode={diagnosis.mode} nodesById={nodesById} />}

      {diagnosis.mode && (
        <DeformedDiagram
          nodes={nodes}
          elements={drawable}
          displacements={displacements}
          reactions={[]}
          elementForceValue={new Map()}
          colorByForce={false}
          scale={{ initial: 0.5, max: 2, step: 0.1 }}
          legend={
            <>
              Línea punteada: el pórtico como está. Línea sólida: así se puede mover sin que ninguna barra se estire
              ni se curve —cada una se traslada y gira entera—. Mové el factor de escala para verlo mejor.
            </>
          }
        />
      )}

      <p className="text-xs text-muted-foreground">
        Por qué la matriz de rigidez es singular, y por qué el determinante no sirve para darse cuenta:{" "}
        <Link href="/estabilidad" className="underline underline-offset-3 hover:text-foreground">
          estabilidad y unicidad de la solución
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * Qué tipo de "no tiene solución" es este. Si la carga tiene componente en la
 * dirección del movimiento libre no hay equilibrio —la estructura acelera—; si
 * es ortogonal, hay equilibrio en infinitas posiciones.
 *
 * La carga es **toda** la del sistema: la de los nudos y la de las barras, que
 * llega a los nudos por su carga nodal equivalente. Contra la de los nudos sola,
 * un pórtico cargado solo en la viga parecería sin carga, y el veredicto
 * podría salir al revés.
 */
function Fredholm({
  mode,
  nodesById,
}: {
  mode: NonNullable<MechanismDiagnosis["mode"]>;
  nodesById: Map<string, NodeRow>;
}) {
  const { equivalentByNode } = useAtomValue(atomMemberLoads);
  const forces = mode.map((dof) => {
    const node = nodesById.get(dof.nodeId);
    if (!node) return 0;
    const nodal = [node.forceX, node.forceZ, node.momentR][dof.localDof];
    return nodal + (equivalentByNode.get(dof.nodeId)?.[dof.localDof] ?? 0);
  });

  const { verdict } = loadCompatibility([mode.map((dof) => dof.value)], forces);

  return (
    <p className="max-w-3xl text-sm">
      {verdict === "accelerates" ? (
        <>
          <span className="font-medium text-destructive">Y con esta carga no hay ningún equilibrio posible:</span> la
          carga —la de los nudos más la de las barras— empuja justo en la dirección en la que el pórtico puede moverse,
          así que aceleraría. No es que falte calcular algo: la estática no tiene nada que responder acá.
        </>
      ) : (
        <>
          <span className="font-medium">Con esta carga sí hay equilibrio</span>, pero en infinitas posiciones: la carga
          es perpendicular al movimiento libre. Lo que no se puede saber es dónde queda parado el pórtico.
        </>
      )}
    </p>
  );
}

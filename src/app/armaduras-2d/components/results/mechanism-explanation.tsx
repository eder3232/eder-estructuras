"use client";

import Link from "next/link";

import { loadCompatibility, type MechanismDiagnosis } from "@/lib/engine";
import { DeformedDiagram } from "@/components/custom/diagram-2d/deformed-diagram";
import type { NodeRow } from "../../store/nodes";

const AXIS_LABEL = ["x", "z"];

/**
 * El error más común del principiante, convertido en la lección que tiene
 * adentro.
 *
 * Que la matriz no se pueda invertir significa que la estructura **puede
 * moverse sin deformarse**: eso no es un problema numérico, es el momento en
 * que se entiende para qué sirven los apoyos. Así que en vez de un mensaje se
 * muestra el movimiento — el modo de cuerpo rígido, dibujado.
 *
 * **Vive en `results/` y no junto a las alertas de error**, aunque llegue por
 * la misma vía. Las alertas señalan una fila mal cargada y por eso van pegadas
 * a las tablas; esto no es un dato mal cargado: es lo que el motor tuvo para
 * decir, o sea una salida. Va donde el usuario fue a buscar el resultado.
 */
export function MechanismExplanation({
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 text-sm">
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

      {diagnosis.mode && <Fredholm mode={diagnosis.mode} nodesById={nodesById} />}

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
 * Qué tipo de "no tiene solución" es este, que son dos y muy distintos.
 *
 * Que la estructura pueda moverse no dice todavía qué pasa con **esta** carga.
 * La alternativa de Fredholm sí: si la carga tiene componente en la dirección
 * del movimiento libre no existe ninguna configuración en equilibrio —la
 * estructura acelera, y eso ya no es estática—; si es ortogonal hay equilibrio
 * en infinitas posiciones, y como el movimiento no deforma ninguna barra los
 * esfuerzos igual quedan determinados.
 */
function Fredholm({
  mode,
  nodesById,
}: {
  mode: NonNullable<MechanismDiagnosis["mode"]>;
  nodesById: Map<string, NodeRow>;
}) {
  const forces = mode.map((dof) => {
    const node = nodesById.get(dof.nodeId);
    if (!node) return 0;
    return dof.localDof === 0 ? node.forceX : node.forceZ;
  });

  const { verdict } = loadCompatibility([mode.map((dof) => dof.value)], forces);

  return (
    <p className="max-w-3xl text-sm">
      {verdict === "accelerates" ? (
        <>
          <span className="font-medium text-destructive">Y con esta carga no hay ningún equilibrio posible:</span> la
          carga empuja justo en la dirección en la que la estructura puede moverse, así que aceleraría. No es que falte
          calcular algo — la estática no tiene nada que responder acá.
        </>
      ) : (
        <>
          <span className="font-medium">Con esta carga sí hay equilibrio</span>, pero en infinitas posiciones: la carga
          es perpendicular al movimiento libre. Curiosamente, como ese movimiento no deforma ninguna barra,{" "}
          <span className="font-medium">los esfuerzos quedarían determinados</span> — lo único que no se puede saber es
          dónde queda parada la estructura.
        </>
      )}
    </p>
  );
}

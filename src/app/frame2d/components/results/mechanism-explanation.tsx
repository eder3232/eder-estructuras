import type { MechanismDiagnosis } from "@/lib/engine";
import type { NodeRow } from "../../store/nodes";

/** Por debajo de esto, la componente del modo se considera cero: ese nudo no se mueve. */
const MOVES = 1e-9;
const AXES = ["x", "z", "θ"];

/**
 * El diagnóstico de mecanismo de un pórtico, en palabras. El dibujo del
 * movimiento es un paso aparte del plan (docs/frame2d-v1.md, paso 8).
 *
 * En un pórtico el caso típico **no** es el de las armaduras: una barra de
 * pórtico resiste también flexión, así que un nudo con barras rara vez queda
 * suelto. Lo que falta casi siempre es un apoyo —el pórtico entero se traslada
 * o gira—, o hay tantas articulaciones que un tramo se vuelve una cadena.
 */
export function MechanismExplanation({
  diagnosis,
  nodesById,
}: {
  diagnosis: MechanismDiagnosis;
  nodesById: Map<string, NodeRow>;
}) {
  const nameOf = (nodeId: string) => nodesById.get(nodeId)?.name ?? nodeId;
  const loose = diagnosis.loose.map((dof) => `${nameOf(dof.nodeId)} en ${AXES[dof.localDof]}`);
  const looseNodes = new Set(diagnosis.loose.map((dof) => dof.nodeId));
  // Solo los nudos que se mueven **además** de los sueltos: si el modo es el
  // mismo grado suelto, ya está dicho arriba.
  const moving = [
    ...new Set(
      (diagnosis.mode ?? [])
        .filter((dof) => Math.abs(dof.value) > MOVES && !looseNodes.has(dof.nodeId))
        .map((dof) => nameOf(dof.nodeId)),
    ),
  ];

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="max-w-3xl text-muted-foreground">
        Una estructura se resuelve cuando cada movimiento posible encuentra algo que se le oponga. Acá hay al menos
        uno que no: una parte puede moverse{" "}
        <span className="font-medium text-foreground">sin estirar ni flexionar ninguna barra</span>, y un movimiento
        que no deforma nada no necesita fuerza. Por eso no hay una solución única — no es un problema de números, es
        que falta sujetar algo.
      </p>
      {loose.length > 0 && (
        <p className="max-w-3xl text-muted-foreground">
          Sin ninguna barra que lo frene: <span className="font-medium text-foreground">{loose.join(", ")}</span>. Su
          fila de la matriz es toda de ceros: a ese nudo no llega ninguna barra que resista en esa dirección.
        </p>
      )}
      {moving.length > 0 && (
        <p className="max-w-3xl text-muted-foreground">
          {moving.length === 1 ? "Se mueve" : "Se mueven juntos"}, sin deformar ninguna barra:{" "}
          <span className="font-medium text-foreground">{moving.join(", ")}</span>. En el plano hay tres movimientos
          de cuerpo rígido —dos traslaciones y un giro— y los apoyos tienen que frenar los tres; lo más común es que
          falte frenar el desplazamiento horizontal.
        </p>
      )}
    </div>
  );
}

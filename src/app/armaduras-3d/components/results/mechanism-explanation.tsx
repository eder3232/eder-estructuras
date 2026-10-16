import type { MechanismDiagnosis } from "@/lib/engine";
import type { NodeRow } from "../../store/nodes";

/** Por debajo de esto, la componente del modo se considera cero: ese nudo no se mueve. */
const MOVES = 1e-9;
const AXES = ["x", "y", "z"];

/**
 * El diagnóstico de mecanismo de una armadura espacial, en palabras. El
 * movimiento se dibuja además sobre la escena del esquema (`mechanismMotion`).
 *
 * El caso que más enseña en 3D es el **grado de libertad suelto**: un nudo
 * cuyas barras están todas en un mismo plano no tiene rigidez fuera de él,
 * porque una barra solo resiste sobre su propio eje. Su fila de la matriz sale
 * de ceros, y eso es lo que el motor nombra en `loose`.
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
  // mismo grado suelto (el tetraedro aplastado), ya está dicho arriba, y hablar
  // de "un giro del conjunto" sería falso.
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
        <span className="font-medium text-foreground">sin estirar ni acortar ninguna barra</span>, y un movimiento que
        no deforma nada no necesita fuerza. Por eso no hay una solución única — no es un problema de números, es que
        falta sujetar algo.
      </p>
      {loose.length > 0 && (
        <p className="max-w-3xl text-muted-foreground">
          Sin ninguna barra que lo frene: <span className="font-medium text-foreground">{loose.join(", ")}</span>. Su
          fila de la matriz es toda de ceros. En el espacio es el caso típico de un nudo con{" "}
          <span className="font-medium text-foreground">todas sus barras en un mismo plano</span>: una barra solo
          resiste a lo largo de su eje, así que ninguna se opone a que el nudo salga de ese plano.
        </p>
      )}
      {moving.length > 0 && (
        <p className="max-w-3xl text-muted-foreground">
          {moving.length === 1 ? "Se mueve" : "Se mueven juntos"}, sin deformar ninguna barra:{" "}
          <span className="font-medium text-foreground">{moving.join(", ")}</span>. Puede ser una traslación o un giro
          del conjunto: en el espacio hay seis movimientos de cuerpo rígido, y los apoyos tienen que frenar los seis.
        </p>
      )}
    </div>
  );
}

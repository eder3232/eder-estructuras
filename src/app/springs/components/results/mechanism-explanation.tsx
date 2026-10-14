import type { MechanismDiagnosis } from "@/lib/engine";
import type { NodeRow } from "../../store/nodes";

/** Por debajo de esto, la componente del modo se considera cero: ese nudo no se mueve. */
const MOVES = 1e-9;

/**
 * El diagnóstico de mecanismo de un sistema de resortes, **en palabras**.
 *
 * En `/armaduras-2d` el movimiento se dibuja; acá no hay dibujo (no hay
 * geometría: ver `docs/springs-v1.md`), pero en una dimensión no hace falta.
 * Un mecanismo en resortes es siempre lo mismo: **un grupo de nudos que se
 * traslada entero sin estirar ningún resorte**, porque nada lo ata a un apoyo.
 * Nombrar ese grupo es nombrar el movimiento.
 */
export function MechanismExplanation({
  diagnosis,
  nodesById,
}: {
  diagnosis: MechanismDiagnosis;
  nodesById: Map<string, NodeRow>;
}) {
  const nameOf = (nodeId: string) => nodesById.get(nodeId)?.name ?? nodeId;
  const moving = (diagnosis.mode ?? []).filter((dof) => Math.abs(dof.value) > MOVES).map((dof) => nameOf(dof.nodeId));
  const loose = diagnosis.loose.map((dof) => nameOf(dof.nodeId));

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="max-w-3xl text-muted-foreground">
        Un sistema se resuelve cuando cada movimiento posible encuentra algo que se le oponga. Acá hay al menos uno
        que no: una parte del sistema puede desplazarse{" "}
        <span className="font-medium text-foreground">sin estirar ni comprimir ningún resorte</span>, y un movimiento
        que no deforma nada no necesita fuerza. Por eso no hay una solución única — no es un problema de números, es
        que falta sujetar algo.
      </p>
      {loose.length > 0 && (
        <p className="max-w-3xl text-muted-foreground">
          Sin ningún resorte que lo sostenga: <span className="font-medium text-foreground">{loose.join(", ")}</span>.
          Su fila de la matriz es toda de ceros.
        </p>
      )}
      {moving.length > 0 && (
        <p className="max-w-3xl text-muted-foreground">
          Se pueden mover {moving.length === 1 ? "solo, sin nada que lo frene" : "juntos, la misma distancia"}:{" "}
          <span className="font-medium text-foreground">{moving.join(", ")}</span>. Ningún apoyo los ata, así que hace
          falta restringir uno de ellos o conectarlos con un resorte a una parte que sí esté sujeta.
        </p>
      )}
    </div>
  );
}

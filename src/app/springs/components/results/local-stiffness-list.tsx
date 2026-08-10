import { MatrixTable } from "../matrix-table";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";

interface LocalStiffnessListProps {
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
}

/**
 * La rigidez local de un resorte no tiene transformación geométrica (a
 * diferencia de una barra de armadura) — es literalmente [[k,-k],[-k,k]],
 * así que se arma acá con el `k` del elemento, sin duplicar ninguna
 * fórmula del motor.
 */
export function LocalStiffnessList({ elements, nodesById }: LocalStiffnessListProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Cada resorte aporta una matriz de rigidez local de 2×2, con la forma general:
      </p>
      <MatrixTable matrix={[[1, -1], [-1, 1]]} className="w-fit" />
      <p className="text-sm text-muted-foreground">multiplicada por su propio k. Para cada elemento:</p>
      <div className="flex flex-wrap gap-6">
        {elements.map((element) => {
          const from = nodesById.get(element.fromNodeId)?.name ?? "?";
          const to = nodesById.get(element.toNodeId)?.name ?? "?";
          return (
            <div key={element.id} className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                {element.name} (k={element.k}, {from}↔{to})
              </p>
              <MatrixTable
                matrix={[
                  [element.k, -element.k],
                  [-element.k, element.k],
                ]}
                labels={[from, to]}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

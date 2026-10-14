import { Math, MathBlock, texText } from "@/components/custom/math";
import { MatrixTable } from "@/components/custom/matrix-table";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";

interface LocalStiffnessListProps {
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
}

/**
 * La rigidez de cada resorte. **No hay transformación** —a diferencia de una
 * barra de armadura, el resorte ya trabaja sobre el único eje del sistema—, así
 * que la matriz local *es* la global del elemento: `k·[[1, −1], [−1, 1]]`. Se
 * arma acá con la `k` de la fila, sin duplicar ninguna fórmula del motor.
 *
 * Lo que sí vale la pena decir es **de dónde sale esa forma**, porque es la
 * idea que después se reusa en todo el método: cada columna es lo que pasa
 * cuando un extremo se mueve una unidad y el otro queda quieto.
 */
export function LocalStiffnessList({ elements, nodesById }: LocalStiffnessListProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Un resorte une dos nudos, <Math tex="i" /> y <Math tex="j" />. Para desplazar <Math tex="i" /> una unidad con{" "}
        <Math tex="j" /> quieto hay que deformar el resorte una unidad: eso pide una fuerza <Math tex="k" /> sobre{" "}
        <Math tex="i" />, y en <Math tex="j" /> aparece la misma fuerza al revés, <Math tex="-k" />. Esa es la primera
        columna; la segunda es lo mismo con los papeles cambiados:
      </p>
      <MathBlock tex="k_e = k \begin{bmatrix} 1 & -1 \\ -1 & 1 \end{bmatrix}" />
      <p className="text-sm text-muted-foreground">
        Cada fila suma cero: un resorte no hace fuerza neta sobre el sistema, solo la pasa de un nudo al otro. Para cada
        resorte, con su propia <Math tex="k" />:
      </p>
      <div className="flex flex-wrap gap-6">
        {elements.map((element) => {
          const from = nodesById.get(element.fromNodeId)?.name ?? "?";
          const to = nodesById.get(element.toNodeId)?.name ?? "?";
          return (
            <div key={element.id} className="flex flex-col gap-1">
              <Math
                className="text-sm"
                tex={`k_{${texText(element.name)}} = ${element.k} \\begin{bmatrix} 1 & -1 \\\\ -1 & 1 \\end{bmatrix}`}
              />
              <span className="text-xs text-muted-foreground">
                de {from} a {to}
              </span>
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

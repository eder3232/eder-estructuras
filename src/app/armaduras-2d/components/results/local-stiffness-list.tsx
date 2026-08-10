import { TrussElement2D } from "@/lib/engine";
import { MatrixTable } from "@/components/custom/matrix-table";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";

interface LocalStiffnessListProps {
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
}

/**
 * A diferencia de un resorte, una barra de armadura tiene rigidez axial en
 * ejes locales (EA/L·[[1,-1],[-1,1]]) que se transforma a ejes globales vía
 * T·k·Tᵀ, con T dependiente de cos/sin del ángulo de la barra. La rigidez
 * axial local se recalcula acá solo para mostrarla (no cambia el resultado);
 * la rigidez global 4×4 se obtiene de `TrussElement2D.stiffness()`, la misma
 * que usa `System`, para no reimplementar la multiplicación de matrices.
 */
export function LocalStiffnessList({ elements, nodesById }: LocalStiffnessListProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Cada barra aporta una rigidez axial local de 2×2 (EA/L·[[1,-1],[-1,1]]), que se transforma a ejes globales
        según el ángulo de la barra:
      </p>
      <div className="flex flex-wrap gap-6">
        {elements.map((element) => {
          const from = nodesById.get(element.fromNodeId);
          const to = nodesById.get(element.toNodeId);
          if (!from || !to) return null;

          const dx = to.x - from.x;
          const dz = to.z - from.z;
          const length = Math.hypot(dx, dz);
          if (length === 0) return null;
          const cos = dx / length;
          const sin = dz / length;
          const eaOverL = (element.elasticity * element.area) / length;

          const globalStiffness = new TrussElement2D(
            element.id,
            { id: from.id, x: from.x, z: from.z },
            { id: to.id, x: to.x, z: to.z },
            element.area,
            element.elasticity,
          ).stiffness();

          return (
            <div key={element.id} className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                {element.name} ({from.name}↔{to.name}): L={length.toFixed(4)}, cos={cos.toFixed(4)}, sin=
                {sin.toFixed(4)}, EA/L={eaOverL.toFixed(4)}
              </p>
              <div className="flex flex-wrap items-end gap-6">
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">Rigidez axial local</p>
                  <MatrixTable
                    matrix={[
                      [eaOverL, -eaOverL],
                      [-eaOverL, eaOverL],
                    ]}
                    labels={["axial " + from.name, "axial " + to.name]}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">Rigidez global (T·k·Tᵀ)</p>
                  <MatrixTable
                    matrix={globalStiffness}
                    labels={[`${from.name}x`, `${from.name}z`, `${to.name}x`, `${to.name}z`]}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

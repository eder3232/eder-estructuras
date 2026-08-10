import { TrussElement3D } from "@/lib/engine";
import { MatrixTable } from "@/components/custom/matrix-table";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";

interface LocalStiffnessListProps {
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
}

/**
 * Igual que en armaduras 2D, la rigidez axial local (EA/L·[[1,-1],[-1,1]]) se
 * recalcula acá solo para mostrarla, pero la matriz global 6×6 sale de
 * `TrussElement3D.stiffness()` — la misma que usa `System` — para no
 * reimplementar la multiplicación T·k·Tᵀ. Lo único nuevo respecto al caso plano
 * es que hay tres cosenos directores en vez de cos/sen.
 */
export function LocalStiffnessList({ elements, nodesById }: LocalStiffnessListProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Cada barra aporta una rigidez axial local de 2×2 (EA/L·[[1,-1],[-1,1]]), que se lleva a ejes globales con la
        matriz de transformación T armada con sus tres cosenos directores (cx, cy, cz): la barra solo resiste sobre su
        propio eje, y esos cosenos reparten esa única rigidez entre los 3 DOF de cada extremo.
      </p>
      <div className="flex flex-wrap gap-6">
        {elements.map((element) => {
          const from = nodesById.get(element.fromNodeId);
          const to = nodesById.get(element.toNodeId);
          if (!from || !to) return null;

          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const dz = to.z - from.z;
          const length = Math.hypot(dx, dy, dz);
          if (length === 0) return null;
          const cx = dx / length;
          const cy = dy / length;
          const cz = dz / length;
          const eaOverL = (element.elasticity * element.area) / length;

          const globalStiffness = new TrussElement3D(
            element.id,
            { id: from.id, x: from.x, y: from.y, z: from.z },
            { id: to.id, x: to.x, y: to.y, z: to.z },
            element.area,
            element.elasticity,
          ).stiffness();

          return (
            <div key={element.id} className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                {element.name} ({from.name}↔{to.name}): L={length.toFixed(4)}, cx={cx.toFixed(4)}, cy=
                {cy.toFixed(4)}, cz={cz.toFixed(4)}, EA/L={eaOverL.toFixed(4)}
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
                    labels={[
                      `${from.name}x`,
                      `${from.name}y`,
                      `${from.name}z`,
                      `${to.name}x`,
                      `${to.name}y`,
                      `${to.name}z`,
                    ]}
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

import { TrussElement2D } from "@/lib/engine";
import { DecimalsScope, ScopeDecimalsControl, useDecimals } from "@/components/custom/decimals-scope";
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
/**
 * Componente aparte solo para poder leer los decimales del ámbito de la barra:
 * estos escalares estaban con `toFixed(4)` hardcodeado, o sea que el selector
 * global nunca los tocó. Ahora siguen la misma cascada que las matrices.
 */
function ScalarSummary({
  name,
  from,
  to,
  length,
  cos,
  sin,
  eaOverL,
}: {
  name: string;
  from: string;
  to: string;
  length: number;
  cos: number;
  sin: number;
  eaOverL: number;
}) {
  const decimals = useDecimals();
  return (
    <p className="text-sm font-medium">
      {name} ({from}↔{to}): L={length.toFixed(decimals)}, cos={cos.toFixed(decimals)}, sin=
      {sin.toFixed(decimals)}, EA/L={eaOverL.toFixed(decimals)}
    </p>
  );
}

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
            <DecimalsScope key={element.id} id={element.id}>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <ScalarSummary
                    name={element.name}
                    from={from.name}
                    to={to.name}
                    length={length}
                    cos={cos}
                    sin={sin}
                    eaOverL={eaOverL}
                  />
                  <ScopeDecimalsControl />
                </div>
                <div className="flex flex-wrap items-end gap-6">
                  <DecimalsScope id="axial">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">Rigidez axial local</p>
                        <ScopeDecimalsControl />
                      </div>
                      <MatrixTable
                        matrix={[
                          [eaOverL, -eaOverL],
                          [-eaOverL, eaOverL],
                        ]}
                        labels={["axial " + from.name, "axial " + to.name]}
                      />
                    </div>
                  </DecimalsScope>
                  <DecimalsScope id="global">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">Rigidez global (T·k·Tᵀ)</p>
                        <ScopeDecimalsControl />
                      </div>
                      <MatrixTable
                        matrix={globalStiffness}
                        labels={[`${from.name}x`, `${from.name}z`, `${to.name}x`, `${to.name}z`]}
                      />
                    </div>
                  </DecimalsScope>
                </div>
              </div>
            </DecimalsScope>
          );
        })}
      </div>
    </div>
  );
}

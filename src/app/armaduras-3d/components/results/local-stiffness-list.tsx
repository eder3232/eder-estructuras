import { TrussElement3D } from "@/lib/engine";
import { ChainEquation } from "@/components/custom/chain-equation";
import { DecimalsScope, ScopeDecimalsStepper, useDecimals } from "@/components/custom/decimals-scope";
import { Math, MathBlock, texText } from "@/components/custom/math";
import type { ElementRow } from "../../store/elements";
import { dofLabels, type NodeRow } from "../../store/nodes";

interface LocalStiffnessListProps {
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
}

/** Los escalares de una barra, con los decimales de su ámbito. */
function ScalarSummary({
  name,
  from,
  to,
  length,
  cosines,
  eaOverL,
}: {
  name: string;
  from: string;
  to: string;
  length: number;
  cosines: [number, number, number];
  eaOverL: number;
}) {
  const decimals = useDecimals();
  const [cx, cy, cz] = cosines;
  return (
    // `span` y no `p`: al lado va el stepper (ver docs/components.md).
    <span className="text-sm">
      <span className="font-medium">
        {name} ({from}↔{to})
      </span>
      : <Math tex="L" />={length.toFixed(decimals)}, <Math tex="C_x" />={cx.toFixed(decimals)},{" "}
      <Math tex="C_y" />={cy.toFixed(decimals)}, <Math tex="C_z" />={cz.toFixed(decimals)},{" "}
      <Math tex="\frac{EA}{L}" />={eaOverL.toFixed(decimals)}
    </span>
  );
}

/**
 * La rigidez de cada barra, con la misma forma que en `/armaduras-2d`: las
 * fórmulas una sola vez arriba, y por barra la cadena `K = A·k·Aᵀ` con sus
 * cuatro operandos. Todo sale de `TrussElement3D.breakdown()`, el mismo
 * elemento que ensambla `System`; antes esta lista recalculaba los cosenos con
 * las coordenadas.
 *
 * Lo único nuevo respecto del plano es un coseno más, y que la cadena ya no
 * entra en la página (`A` de 6×2, `K` de 6×6): por eso `ChainEquation` ofrece
 * verla apilada.
 */
export function LocalStiffnessList({ elements, nodesById }: LocalStiffnessListProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Una barra de armadura espacial resiste igual que una plana: solo a lo largo de su eje. En sus ejes locales
          su rigidez es la misma de 2×2, que depende solo de <Math tex="EA/L" />:
        </p>
        <MathBlock tex="k = \frac{EA}{L}\begin{bmatrix} 1 & -1 \\ -1 & 1 \end{bmatrix}" />
        <p className="text-sm text-muted-foreground">
          Lo que cambia es la transformación. Cada extremo tiene ahora tres grados de libertad, así que{" "}
          <Math tex="A" /> reparte el desplazamiento axial entre <Math tex="x" />, <Math tex="y" /> y{" "}
          <Math tex="z" /> con los tres cosenos directores de la barra:
        </p>
        <MathBlock tex="A = \begin{bmatrix} C_x & 0 \\ C_y & 0 \\ C_z & 0 \\ 0 & C_x \\ 0 & C_y \\ 0 & C_z \end{bmatrix} \qquad C_x = \frac{\Delta x}{L},\quad C_y = \frac{\Delta y}{L},\quad C_z = \frac{\Delta z}{L}" />
        <p className="text-sm text-muted-foreground">
          Con eso, la rigidez de la barra en ejes globales es una matriz de 6×6:
        </p>
        <MathBlock tex="K = A \cdot k \cdot A^{T}" />
        <p className="text-sm text-muted-foreground">
          Hacer la cuenta deja ver su forma: cuatro bloques de 3×3, y los cuatro son el mismo con el signo
          cambiado. Basta con calcular uno, el del nudo de origen, cuyas celdas son{" "}
          <Math tex="\frac{EA}{L}\,C_i\,C_j" />:
        </p>
        <MathBlock tex="K = \begin{bmatrix} K_{aa} & -K_{aa} \\ -K_{aa} & K_{aa} \end{bmatrix} \qquad K_{aa} = \frac{EA}{L}\begin{bmatrix} C_x^2 & C_x C_y & C_x C_z \\ C_x C_y & C_y^2 & C_y C_z \\ C_x C_z & C_y C_z & C_z^2 \end{bmatrix}" />
      </div>

      <div className="flex flex-col gap-8">
        {elements.map((element) => {
          const from = nodesById.get(element.fromNodeId);
          const to = nodesById.get(element.toNodeId);
          if (!from || !to) return null;

          let breakdown;
          try {
            breakdown = new TrussElement3D(
              element.id,
              { id: from.id, x: from.x, y: from.y, z: from.z },
              { id: to.id, x: to.x, y: to.y, z: to.z },
              element.area,
              element.elasticity,
            ).breakdown();
          } catch {
            // Área o longitud inválidas: el panel de errores ya lo está diciendo.
            return null;
          }

          const { length, cosines, eaOverL, transform, transformTransposed, localStiffness, globalStiffness } =
            breakdown;
          const globalLabels = [from, to].flatMap((node) => dofLabels.map((axis) => `${node.name}${axis}`));
          const axialLabels = [`ax. ${from.name}`, `ax. ${to.name}`];
          const barTex = texText(element.name);

          return (
            // Un ámbito de decimales por barra: la cadena entera se mueve junta.
            <DecimalsScope key={element.id} id={element.id}>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <ScalarSummary
                    name={element.name}
                    from={from.name}
                    to={to.name}
                    length={length}
                    cosines={cosines}
                    eaOverL={eaOverL}
                  />
                  <ScopeDecimalsStepper />
                </div>

                <ChainEquation
                  title={`Rigidez de la barra ${element.name} en ejes globales`}
                  result={{ tex: `K_{${barTex}}`, matrix: globalStiffness, rowLabels: globalLabels, colLabels: globalLabels }}
                  factors={[
                    { tex: `A_{${barTex}}`, matrix: transform, rowLabels: globalLabels, colLabels: axialLabels },
                    { tex: `k_{${barTex}}`, matrix: localStiffness, rowLabels: axialLabels, colLabels: axialLabels },
                    { tex: `A^{T}_{${barTex}}`, matrix: transformTransposed, rowLabels: axialLabels, colLabels: globalLabels },
                  ]}
                />
              </div>
            </DecimalsScope>
          );
        })}
      </div>
    </div>
  );
}

import { TrussElement2D } from "@/lib/engine";
import { DecimalsScope, ScopeDecimalsStepper, useDecimals } from "@/components/custom/decimals-scope";
import { Math, MathBlock, texText } from "@/components/custom/math";
import { EquationTerm, MathOp, MatrixEquation } from "@/components/custom/matrix-equation";
import { MatrixTable } from "@/components/custom/matrix-table";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";

interface LocalStiffnessListProps {
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
}

/**
 * Componente aparte solo para poder leer los decimales del ámbito: estos
 * escalares estaban con `toFixed(4)` hardcodeado, o sea que el selector global
 * nunca los tocó. Ahora siguen a la sección, como las matrices que no tienen
 * número propio.
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
    // `span` y no `p`: al lado va el stepper, y `AccordionContent` le mete
    // `mb-4` a todo `p` que no sea `:last-child` (ver docs/components.md).
    <span className="text-sm">
      <span className="font-medium">
        {name} ({from}↔{to})
      </span>
      : <Math tex="L" />={length.toFixed(decimals)}, <Math tex="C_x" />={cos.toFixed(decimals)},{" "}
      <Math tex="C_z" />={sin.toFixed(decimals)}, <Math tex="\frac{EA}{L}" />={eaOverL.toFixed(decimals)}
    </span>
  );
}

/**
 * A diferencia de un resorte, una barra de armadura tiene rigidez axial en ejes
 * locales que se transforma a ejes globales según el ángulo de la barra. **Ese
 * es el único paso que distingue una armadura de un resorte**, así que se
 * muestra entero: `A`, `k` y `Aᵀ` como operandos, no solo el resultado.
 *
 * Todas las matrices salen de `TrussElement2D.breakdown()` —la misma que usa
 * `System` para ensamblar—, no de recalcular la geometría acá. Antes esta página
 * y la de fuerzas internas tenían cada una su copia de `cos`/`sin`/`EA/L`.
 *
 * Las formas simbólicas van **una sola vez** arriba y no repetidas por barra:
 * son idénticas para todas, que es justamente lo que las hace fórmulas. El
 * original las repetía en cada barra.
 */
export function LocalStiffnessList({ elements, nodesById }: LocalStiffnessListProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Cada barra aporta una rigidez axial de 2×2 en sus ejes locales, que depende solo de <Math tex="EA/L" />:
        </p>
        <MathBlock tex="k = \frac{EA}{L}\begin{bmatrix} 1 & -1 \\ -1 & 1 \end{bmatrix}" />
        <p className="text-sm text-muted-foreground">
          Para poder sumarlas entre sí hay que llevarlas a ejes globales. La matriz de transformación{" "}
          <Math tex="A" /> se arma con los cosenos directores de la barra, y reparte cada extremo axial en sus dos
          componentes <Math tex="x" /> y <Math tex="z" />:
        </p>
        <MathBlock tex="A = \begin{bmatrix} C_x & 0 \\ C_z & 0 \\ 0 & C_x \\ 0 & C_z \end{bmatrix} \qquad C_x = \frac{\Delta x}{L},\quad C_z = \frac{\Delta z}{L}" />
        <p className="text-sm text-muted-foreground">
          Con eso, la rigidez de la barra en ejes globales es:
        </p>
        <MathBlock tex="K = A \cdot k \cdot A^{T}" />
      </div>

      <div className="flex flex-col gap-8">
        {elements.map((element) => {
          const from = nodesById.get(element.fromNodeId);
          const to = nodesById.get(element.toNodeId);
          if (!from || !to) return null;

          // Se construye el mismo elemento que usa el motor y se le piden los
          // pasos intermedios, en vez de rehacer la geometría con las
          // coordenadas. Si la fórmula del motor cambia, esto cambia con ella.
          let breakdown;
          try {
            breakdown = new TrussElement2D(
              element.id,
              { id: from.id, x: from.x, z: from.z },
              { id: to.id, x: to.x, z: to.z },
              element.area,
              element.elasticity,
            ).breakdown();
          } catch {
            // Área o longitud inválidas: el panel de errores ya lo está diciendo.
            return null;
          }

          const { length, cos, sin, eaOverL, transform, transformTransposed, localStiffness, globalStiffness } =
            breakdown;
          const globalLabels = [`${from.name}x`, `${from.name}z`, `${to.name}x`, `${to.name}z`];
          const axialLabels = [`ax. ${from.name}`, `ax. ${to.name}`];
          const barTex = texText(element.name);

          return (
            // Un ámbito de decimales por barra: la cadena entera se mueve junta.
            // Un stepper por matriz serían cuatro por barra, y con seis barras la
            // pantalla se vuelve una grilla de controles indistinguibles.
            <DecimalsScope key={element.id} id={element.id}>
              <div className="flex flex-col gap-2">
                {/* Sin `justify-between`: el stepper va pegado a su etiqueta, si
                    no se corre solo al ensanchar las tablas (ver
                    `ScopeDecimalsStepper`). */}
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
                  <ScopeDecimalsStepper />
                </div>

                <MatrixEquation>
                  <EquationTerm tex={`K_{${barTex}}`}>
                    <MatrixTable matrix={globalStiffness} labels={globalLabels} />
                  </EquationTerm>
                  <MathOp tex="=" />
                  <EquationTerm tex={`A_{${barTex}}`}>
                    <MatrixTable matrix={transform} rowLabels={globalLabels} colLabels={axialLabels} />
                  </EquationTerm>
                  <MathOp tex="\cdot" />
                  <EquationTerm tex={`k_{${barTex}}`}>
                    <MatrixTable matrix={localStiffness} labels={axialLabels} />
                  </EquationTerm>
                  <MathOp tex="\cdot" />
                  <EquationTerm tex={`A^{T}_{${barTex}}`}>
                    <MatrixTable matrix={transformTransposed} rowLabels={axialLabels} colLabels={globalLabels} />
                  </EquationTerm>
                </MatrixEquation>
              </div>
            </DecimalsScope>
          );
        })}
      </div>
    </div>
  );
}

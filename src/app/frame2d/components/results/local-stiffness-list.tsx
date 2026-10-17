"use client";

import { useAtomValue } from "jotai";
import { multiply, transpose } from "mathjs";

import { FrameElement2D, loadFixedEndForces, memberAxis, type FrameFixedEndForces } from "@/lib/engine";
import { ChainEquation } from "@/components/custom/chain-equation";
import { DecimalsScope, ScopeDecimalsStepper, useDecimals } from "@/components/custom/decimals-scope";
import { Math, MathBlock, texText } from "@/components/custom/math";
import { EquationTerm, MathOp, MatrixEquation } from "@/components/custom/matrix-equation";
import { MatrixTable } from "@/components/custom/matrix-table";
import type { ElementRow } from "../../store/elements";
import { atomLoads, toMemberLoad, type LoadRow } from "../../store/loads";
import { dofLabels, type NodeRow } from "../../store/nodes";

interface LocalStiffnessListProps {
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
}

const LOCAL_AXES = ["x′", "y′", "θ"];

const toVector = ({ from, to }: FrameFixedEndForces) => [
  [from.axial],
  [from.shear],
  [from.moment],
  [to.axial],
  [to.shear],
  [to.moment],
];

/** Los escalares de una barra, con los decimales de su ámbito. */
function ScalarSummary({
  name,
  from,
  to,
  length,
  cos,
  sin,
  eaOverL,
  ei,
}: {
  name: string;
  from: string;
  to: string;
  length: number;
  cos: number;
  sin: number;
  eaOverL: number;
  ei: number;
}) {
  const decimals = useDecimals();
  const show = (value: number) => value.toFixed(decimals);
  return (
    // `span` y no `p`: al lado va el stepper (ver docs/components.md).
    <span className="text-sm">
      <span className="font-medium">
        {name} ({from}↔{to})
      </span>
      : <Math tex="L" />={show(length)}, <Math tex="c" />={show(cos)}, <Math tex="s" />={show(sin)},{" "}
      <Math tex="\frac{EA}{L}" />={show(eaOverL)}, <Math tex="\frac{12EI}{L^3}" />={show((12 * ei) / length ** 3)},{" "}
      <Math tex="\frac{6EI}{L^2}" />={show((6 * ei) / length ** 2)}, <Math tex="\frac{4EI}{L}" />={show((4 * ei) / length)}
    </span>
  );
}

const KIND = { distributed: "distribuida", point: "puntual", moment: "momento" } as const;

/**
 * La rigidez de cada barra con la forma de los otros sistemas: las fórmulas una
 * vez arriba, y por barra la cadena `K = Tᵀ·k·T` con sus operandos —que no
 * entra en una fila: para eso `ChainEquation` ofrece verla apilada y en
 * pantalla completa—. Las matrices salen de `FrameElement2D`, la misma clase
 * que ensambla `System`.
 *
 * Y lo que tiene un pórtico y no una armadura: **el FEM de cada barra cargada**,
 * carga por carga, sumado, y llevado a ejes globales con `Tᵀ`. Es el paso del
 * método que el original hacía en un diálogo aparte, con fórmulas mal (V1–V2
 * de `docs/frame2d-v1.md`).
 */
export function LocalStiffnessList({ elements, nodesById }: LocalStiffnessListProps) {
  const loads = useAtomValue(atomLoads);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Una barra de pórtico resiste a lo largo de su eje y además a flexión. En sus ejes locales —
          <Math tex="x'" /> a lo largo de la barra, <Math tex="y'" /> perpendicular— su rigidez es de 6×6, con la
          parte axial (<Math tex="EA/L" />) desacoplada de la de flexión, que depende de la inercia:
        </p>
        <MathBlock tex="k = \begin{bmatrix} \frac{EA}{L} & 0 & 0 & -\frac{EA}{L} & 0 & 0 \\ 0 & \frac{12EI}{L^3} & \frac{6EI}{L^2} & 0 & -\frac{12EI}{L^3} & \frac{6EI}{L^2} \\ 0 & \frac{6EI}{L^2} & \frac{4EI}{L} & 0 & -\frac{6EI}{L^2} & \frac{2EI}{L} \\ -\frac{EA}{L} & 0 & 0 & \frac{EA}{L} & 0 & 0 \\ 0 & -\frac{12EI}{L^3} & -\frac{6EI}{L^2} & 0 & \frac{12EI}{L^3} & -\frac{6EI}{L^2} \\ 0 & \frac{6EI}{L^2} & \frac{2EI}{L} & 0 & -\frac{6EI}{L^2} & \frac{4EI}{L} \end{bmatrix}" />
        <p className="text-sm text-muted-foreground">
          Para llevarla a ejes globales, <Math tex="T" /> gira las dos traslaciones de cada extremo con el ángulo de la
          barra (<Math tex="c = \Delta x / L" />, <Math tex="s = \Delta z / L" />) y{" "}
          <span className="font-medium text-foreground">deja el giro como está</span>: un giro es el mismo en
          cualquier sistema de ejes del plano.
        </p>
        <MathBlock tex="T = \begin{bmatrix} c & s & 0 & 0 & 0 & 0 \\ -s & c & 0 & 0 & 0 & 0 \\ 0 & 0 & 1 & 0 & 0 & 0 \\ 0 & 0 & 0 & c & s & 0 \\ 0 & 0 & 0 & -s & c & 0 \\ 0 & 0 & 0 & 0 & 0 & 1 \end{bmatrix} \qquad K = T^{T} \cdot k \cdot T" />
      </div>

      <FemFormulas />

      <div className="flex flex-col gap-8">
        {elements.map((element) => {
          const from = nodesById.get(element.fromNodeId);
          const to = nodesById.get(element.toNodeId);
          if (!from || !to) return null;

          let frame: FrameElement2D;
          try {
            frame = new FrameElement2D(
              element.id,
              { id: from.id, x: from.x, z: from.z },
              { id: to.id, x: to.x, z: to.z },
              element.area,
              element.elasticity,
              element.inertia,
            );
          } catch {
            // Sección o longitud inválidas: el panel de errores ya lo está diciendo.
            return null;
          }

          const axis = memberAxis(from, to);
          const t = frame.transform();
          const tT = transpose(t) as number[][];
          const globalLabels = [from, to].flatMap((node) => dofLabels.map((d) => `${node.name}${d}`));
          const localLabels = [from, to].flatMap((node) => LOCAL_AXES.map((d) => `${node.name}${d}`));
          const barTex = texText(element.name);

          return (
            // Un ámbito de decimales por barra: la cadena entera se mueve junta.
            <DecimalsScope key={element.id} id={element.id}>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ScalarSummary
                    name={element.name}
                    from={from.name}
                    to={to.name}
                    length={axis.length}
                    cos={axis.cos}
                    sin={axis.sin}
                    eaOverL={(element.elasticity * element.area) / axis.length}
                    ei={element.elasticity * element.inertia}
                  />
                  <ScopeDecimalsStepper />
                </div>

                <ChainEquation
                  title={`Rigidez de la barra ${element.name} en ejes globales`}
                  result={{ tex: `K_{${barTex}}`, matrix: frame.stiffness(), rowLabels: globalLabels, colLabels: globalLabels }}
                  factors={[
                    { tex: `T^{T}_{${barTex}}`, matrix: tT, rowLabels: globalLabels, colLabels: localLabels },
                    { tex: `k_{${barTex}}`, matrix: frame.localStiffness(), rowLabels: localLabels, colLabels: localLabels },
                    { tex: `T_{${barTex}}`, matrix: t, rowLabels: localLabels, colLabels: globalLabels },
                  ]}
                />

                <MemberFem
                  element={element}
                  loads={loads.filter((l) => l.elementId === element.id)}
                  length={axis.length}
                  axis={axis}
                  transformTransposed={tT}
                  localLabels={localLabels}
                  globalLabels={globalLabels}
                />
              </div>
            </DecimalsScope>
          );
        })}
      </div>
    </div>
  );
}

/** Las fórmulas de tabla de los tres casos de libro, una sola vez, para cotejar con los números de cada barra. */
function FemFormulas() {
  return (
    <details className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">
        Momentos de empotramiento perfecto: las fórmulas de tabla y cómo los calcula el programa
      </summary>
      <div className="mt-3 flex flex-col gap-2">
        <p>
          El FEM es lo que una barra con los dos extremos empotrados desarrolla en ellos por su carga: la{" "}
          <span className="font-medium text-foreground">reacción del empotramiento</span>, en ejes locales. Los casos
          de libro, con la carga hacia abajo (<Math tex="-y'" />) y <Math tex="b = L - a" />:
        </p>
        <MathBlock tex="\text{uniforme } q:\quad V_i = V_j = \frac{qL}{2},\qquad M_i = \frac{qL^2}{12},\quad M_j = -\frac{qL^2}{12}" />
        <MathBlock tex="\text{puntual } P \text{ en } a:\quad V_i = \frac{Pb^2(L+2a)}{L^3},\quad V_j = \frac{Pa^2(L+2b)}{L^3},\qquad M_i = \frac{Pab^2}{L^2},\quad M_j = -\frac{Pa^2b}{L^2}" />
        <MathBlock tex="\text{momento } M_0 \text{ horario en } a:\quad V_i = -V_j = -\frac{6M_0ab}{L^3},\qquad M_i = \frac{M_0 b(2a-b)}{L^2},\quad M_j = -\frac{M_0 a(2b-a)}{L^2}" />
        <p>
          Para cualquier carga —parcial, triangular, trapezoidal, en cualquier dirección— el programa no busca la
          fórmula: integra la carga contra las funciones de forma de la barra, que es de donde salen todas las de la
          tabla. Es exacto, y da lo mismo que la tabla en estos tres casos (lo comprueban los tests):
        </p>
        <MathBlock tex="\mathrm{FEM} = -\int_0^L N(x)^{T}\, q(x)\, dx" />
      </div>
    </details>
  );
}

/**
 * El FEM de una barra: cada carga con su vector, la suma, y el pasaje a ejes
 * globales. Con FEM a mano, el vector escrito. Sin cargas, nada: la barra no
 * aporta al término `FEM` de la ecuación.
 */
function MemberFem({
  element,
  loads,
  length,
  axis,
  transformTransposed,
  localLabels,
  globalLabels,
}: {
  element: ElementRow;
  loads: LoadRow[];
  length: number;
  axis: ReturnType<typeof memberAxis>;
  transformTransposed: number[][];
  localLabels: string[];
  globalLabels: string[];
}) {
  const decimals = useDecimals();
  const barTex = texText(element.name);

  const manual: FrameFixedEndForces = {
    from: { axial: element.femAxialFrom, shear: element.femShearFrom, moment: element.femMomentFrom },
    to: { axial: element.femAxialTo, shear: element.femShearTo, moment: element.femMomentTo },
  };

  let perLoad: { load: LoadRow; vector: number[][] }[];
  try {
    perLoad = element.manualFem
      ? []
      : loads.map((load) => ({ load, vector: toVector(loadFixedEndForces(toMemberLoad(load, length), axis)) }));
  } catch {
    // Una carga mal escrita: el panel de errores la nombra, y sin ella el FEM no significa nada.
    return null;
  }
  if (!element.manualFem && perLoad.length === 0) return null;

  const local = element.manualFem
    ? toVector(manual)
    : perLoad.reduce(
        (sum, { vector }) => sum.map((row, i) => [row[0] + vector[i][0]]),
        localLabels.map(() => [0]),
      );
  const global = multiply(transformTransposed, local) as number[][];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-muted-foreground">
        {element.manualFem ? (
          <>
            FEM de <span className="font-medium text-foreground">{element.name}</span>, escrito a mano:
          </>
        ) : (
          <>
            FEM de <span className="font-medium text-foreground">{element.name}</span>
            {perLoad.length === 1 ? ", de su carga " : `, por superposición de sus ${perLoad.length} cargas: `}
            {perLoad
              .map(({ load }) =>
                load.kind === "moment"
                  ? `${load.name} (momento ${load.q1} en a = ${Number(load.a.toFixed(decimals))})`
                  : load.kind === "point"
                    ? `${load.name} (puntual ${load.q1} en a = ${Number(load.a.toFixed(decimals))})`
                    : `${load.name} (${KIND.distributed} ${load.q1}${load.q2 !== load.q1 ? ` → ${load.q2}` : ""}${
                        load.wholeBar ? ", toda la barra" : ` de ${load.a} a ${load.b}`
                      })`,
              )
              .join("; ")}
            .
          </>
        )}
      </span>
      <MatrixEquation expand={{ title: `El FEM de la barra ${element.name}` }}>
        <EquationTerm tex={`\\mathrm{FEM}_{${barTex}}^{\\,\\mathrm{global}}`}>
          <MatrixTable matrix={global} rowLabels={globalLabels} />
        </EquationTerm>
        <MathOp tex="=" />
        <EquationTerm tex={`T^{T}_{${barTex}}`}>
          <MatrixTable matrix={transformTransposed} rowLabels={globalLabels} colLabels={localLabels} />
        </EquationTerm>
        <MathOp tex="\cdot" />
        {perLoad.length > 1 && <MathOp tex="\Big(" />}
        {perLoad.length > 1 ? (
          perLoad.map(({ load, vector }, i) => (
            <span key={load.id} className="contents">
              {i > 0 && <MathOp tex="+" />}
              <EquationTerm tex={`\\mathrm{FEM}_{${texText(load.name)}}`}>
                <MatrixTable matrix={vector} rowLabels={localLabels} />
              </EquationTerm>
            </span>
          ))
        ) : (
          <EquationTerm tex={`\\mathrm{FEM}_{${barTex}}`}>
            <MatrixTable matrix={local} rowLabels={localLabels} />
          </EquationTerm>
        )}
        {perLoad.length > 1 && <MathOp tex="\Big)" />}
      </MatrixEquation>
    </div>
  );
}

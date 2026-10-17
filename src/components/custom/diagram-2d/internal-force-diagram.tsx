"use client";

import { useDecimals } from "@/components/custom/decimals-scope";
import { DiagramLabel } from "./diagram-label";
import { DiagramScaleProvider, useDiagramScale } from "./scale-context";
import { SupportIcon } from "./support-icon";
import type { DiagramElement, DiagramNode, DiagramSupport } from "./types";
import { computeUnitSize } from "./unit-scale";
import { computeViewBox, projectPoint, type SvgPoint } from "./viewbox";
import { SvgCanvas } from "./svg-canvas";

/** La curva de un esfuerzo a lo largo de una barra, en su convención de signos. */
export interface MemberCurve {
  /** Ordenados por `x` (largo de la barra desde «desde»); un salto son dos puntos con el mismo `x`. */
  points: { x: number; value: number }[];
  /** Dónde poner un número: extremos, los dos lados de un salto, máximos. */
  labels: { x: number; value: number }[];
}

interface InternalForceDiagramProps {
  nodes: DiagramNode[];
  elements: DiagramElement[];
  supports: DiagramSupport[];
  curves: Map<string, MemberCurve>;
  /**
   * De qué lado de la barra va un valor positivo: `+y'` (a la izquierda de la
   * barra mirándola de «desde» a «hacia») o `−y'`. El momento usa `−y'`, que es
   * **el lado traccionado** con la convención de viga: así se dibuja en los
   * textos de análisis estructural, y señala dónde va el acero.
   */
  positiveSide: "+y" | "-y";
  /**
   * Escribir **una sola vez** el valor de un extremo que coincide con el de
   * otra barra en el mismo nudo. Es para el momento: en un nudo de dos barras
   * sin momento aplicado, el equilibrio obliga a que sean iguales, y los textos
   * lo anotan una vez. En V y N dos valores iguales en un nudo serían
   * casualidad, y esconder uno diría algo que no es.
   */
  mergeJointLabels?: boolean;
  className?: string;
}

/**
 * Violeta, para no confundirse con nada de lo que ya tiene color: el azul es de
 * las cargas, el verde y el rojo son tracción y compresión en la deformada, y
 * el ámbar es de las reacciones. El texto va un tono más oscuro (más claro en
 * oscuro) que el trazo para llegar a 4.5:1 contra el fondo.
 */
const FILL = "fill-violet-500/15 stroke-violet-600 dark:fill-violet-400/20 dark:stroke-violet-400";
const TEXT = "fill-violet-700 dark:fill-violet-300";

/**
 * Un diagrama de esfuerzos dibujado **sobre el pórtico**: cada barra con su
 * curva perpendicular a ella, a la misma escala para todas (dos barras se
 * comparan de un vistazo), con los valores en extremos, saltos y máximos.
 */
export function InternalForceDiagram(props: InternalForceDiagramProps) {
  const values = [...props.curves.values()].flatMap((c) => c.labels.map((l) => l.value));
  return (
    <DiagramScaleProvider values={values}>
      <Canvas {...props} />
    </DiagramScaleProvider>
  );
}

function Canvas({
  nodes,
  elements,
  supports,
  curves,
  positiveSide,
  mergeJointLabels = false,
  className,
}: InternalForceDiagramProps) {
  const decimals = useDecimals();
  const scale = useDiagramScale();
  if (nodes.length === 0) return null;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const viewBox = computeViewBox(nodes.map((n) => projectPoint(n)));
  const unitSize = computeUnitSize(viewBox);

  const maxAbs = Math.max(0, ...[...curves.values()].flatMap((c) => c.points.map((p) => Math.abs(p.value))));
  // La curva más alta mide 3.5 unidades del dibujo: entra en el margen del lienzo con su número.
  const height = unitSize * 3.5;
  const factor = maxAbs > 0 ? height / maxAbs : 0;
  const side = positiveSide === "+y" ? 1 : -1;
  // Por debajo de esto un número es ruido de punto flotante, no un esfuerzo.
  const negligible = maxAbs * 1e-9;
  // Los valores de extremo ya escritos en cada nudo (ver `mergeJointLabels`).
  const writtenAtNode = new Map<string, number[]>();
  const alreadyWritten = (nodeId: string, value: number) => {
    const written = writtenAtNode.get(nodeId) ?? [];
    const repeated = written.some((w) => Math.abs(Math.abs(w) - Math.abs(value)) <= maxAbs * 1e-6);
    if (!repeated) writtenAtNode.set(nodeId, [...written, value]);
    return mergeJointLabels && repeated;
  };

  return (
    <SvgCanvas viewBox={viewBox} className={className}>
      {elements.map((element) => {
        const from = nodesById.get(element.fromNodeId);
        const to = nodesById.get(element.toNodeId);
        const curve = curves.get(element.id);
        if (!from || !to || !curve) return null;

        const length = Math.hypot(to.x - from.x, to.z - from.z);
        if (length === 0) return null;
        const a = projectPoint(from);
        const b = projectPoint(to);
        const along = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
        // `+y'` en coordenadas SVG: el eje de la barra girado 90° antihorario en
        // el modelo, que en pantalla (y hacia abajo) es (dy, −dx).
        const normal = { x: along.y, y: -along.x };
        const base = (x: number): SvgPoint => ({ x: a.x + along.x * x, y: a.y + along.y * x });
        const tip = (x: number, value: number): SvgPoint => {
          const p = base(x);
          const k = side * value * factor;
          return { x: p.x + normal.x * k, y: p.y + normal.y * k };
        };

        const outline = [base(0), ...curve.points.map((p) => tip(p.x, p.value)), base(length)];

        return (
          <g key={element.id}>
            <polygon
              points={outline.map((p) => `${p.x},${p.y}`).join(" ")}
              className={FILL}
              strokeWidth={1.25}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {curve.labels
              .filter((label) => Math.abs(label.value) > negligible)
              .filter((label) => {
                if (label.x !== 0 && label.x !== length) return true;
                return !alreadyWritten(label.x === 0 ? from.id : to.id, label.value);
              })
              .map((label, i) => {
                const p = tip(label.x, label.value);
                const out = Math.sign(side * label.value);
                // Un poco hacia adentro de la barra en los extremos, para no
                // caer sobre el nudo donde llega el número de la barra vecina.
                const inward = label.x < length / 2 ? 1 : -1;
                const nudge = label.x === 0 || label.x === length ? unitSize * 0.6 * inward : 0;
                // En una barra más vertical que horizontal, centrado el número
                // cruza su propia barra: se ancla por el lado que da a ella y
                // crece hacia afuera (la misma regla de `axialLabelPoint`).
                //
                // En una barra más horizontal, el número de un extremo crece
                // **hacia adentro** de la barra: centrado sobre la esquina
                // cruzaba la columna que llega ahí.
                const away = { x: normal.x * out, y: normal.y * out };
                const isEnd = label.x === 0 || label.x === length;
                const inwardX = along.x * inward;
                const anchor =
                  Math.abs(away.x) > Math.abs(away.y)
                    ? away.x > 0
                      ? ("start" as const)
                      : ("end" as const)
                    : isEnd
                      ? inwardX > 0
                        ? ("start" as const)
                        : ("end" as const)
                      : ("middle" as const);
                return (
                  <DiagramLabel
                    key={i}
                    x={p.x + away.x * unitSize * 0.8 + along.x * nudge}
                    y={p.y + away.y * unitSize * 0.8 + along.y * nudge}
                    unitSize={unitSize}
                    anchor={anchor}
                    className={TEXT}
                  >
                    {scale.format(label.value, decimals)}
                  </DiagramLabel>
                );
              })}
          </g>
        );
      })}

      <g className="stroke-foreground" strokeWidth={1.5}>
        {elements.map((element) => {
          const from = nodesById.get(element.fromNodeId);
          const to = nodesById.get(element.toNodeId);
          if (!from || !to) return null;
          const a = projectPoint(from);
          const b = projectPoint(to);
          return <line key={element.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />;
        })}
      </g>

      {supports.map((support) => (
        <SupportIcon
          key={support.nodeId}
          x={support.x}
          z={support.z}
          restrainedX={support.restrainedX}
          restrainedZ={support.restrainedZ}
          restrainedRotation={support.restrainedRotation}
          unitSize={unitSize}
        />
      ))}
    </SvgCanvas>
  );
}

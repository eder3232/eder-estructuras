"use client";

import { useDecimals } from "@/components/custom/decimals-scope";
import { DiagramLabel } from "./diagram-label";
import { DiagramScaleProvider, useDiagramScale } from "./scale-context";
import { SupportIcon } from "./support-icon";
import type { DiagramElement, DiagramNode, DiagramSupport } from "./types";
import { computeUnitSize } from "./unit-scale";
import { computeViewBox, projectPoint, type SvgPoint, type ViewBox } from "./viewbox";
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
  /**
   * Escribir los números **sin signo**. Es para el momento dibujado del lado
   * traccionado: ahí el lado ya dice el signo, y con él los números cambiaban
   * de signo según hacia dónde se dibujó la barra — en un pórtico simétrico,
   * 29.93 en una base y −29.93 en la otra, con las dos traccionando adentro.
   */
  unsigned?: boolean;
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
 * La caja de un texto, en unidades del dibujo (la fuente mide 1 unidad).
 * Medidas sobre el texto renderizado, no supuestas: con 0.6 de ancho y 1.1 de
 * alto, dos números de la cumbrera del pórtico a dos aguas seguían tocándose.
 */
const CHAR_WIDTH = 0.62;
const HALF_HEIGHT = 0.7;

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

interface PlacedLabel {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  text: string;
}

/** La caja que ocupa un texto, según su ancla. */
function boxOf({ x, y, anchor, text }: PlacedLabel, unitSize: number) {
  const width = text.length * CHAR_WIDTH * unitSize;
  const left = anchor === "start" ? x : anchor === "end" ? x - width : x - width / 2;
  return { left, right: left + width, top: y - unitSize * HALF_HEIGHT, bottom: y + unitSize * HALF_HEIGHT };
}

function Canvas({
  nodes,
  elements,
  supports,
  curves,
  positiveSide,
  mergeJointLabels = false,
  unsigned = false,
  className,
}: InternalForceDiagramProps) {
  const decimals = useDecimals();
  const scale = useDiagramScale();
  if (nodes.length === 0) return null;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const baseViewBox = computeViewBox(nodes.map((n) => projectPoint(n)));
  const unitSize = computeUnitSize(baseViewBox);

  const maxAbs = Math.max(0, ...[...curves.values()].flatMap((c) => c.points.map((p) => Math.abs(p.value))));
  // La curva más alta mide 3.5 unidades del dibujo.
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

  // ── Primera pasada: las curvas, y dónde querría ir cada número ──────────
  const outlines: { id: string; points: SvgPoint[] }[] = [];
  const wanted: { label: PlacedLabel; away: SvgPoint }[] = [];

  for (const element of elements) {
    const from = nodesById.get(element.fromNodeId);
    const to = nodesById.get(element.toNodeId);
    const curve = curves.get(element.id);
    if (!from || !to || !curve) continue;

    const length = Math.hypot(to.x - from.x, to.z - from.z);
    if (length === 0) continue;
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

    outlines.push({ id: element.id, points: [base(0), ...curve.points.map((p) => tip(p.x, p.value)), base(length)] });

    for (const label of curve.labels) {
      if (Math.abs(label.value) <= negligible) continue;
      const isEnd = label.x === 0 || label.x === length;
      if (isEnd && alreadyWritten(label.x === 0 ? from.id : to.id, label.value)) continue;

      const p = tip(label.x, label.value);
      const out = Math.sign(side * label.value);
      // Un poco hacia adentro de la barra en los extremos, para no caer sobre
      // el nudo donde llega el número de la barra vecina.
      const inward = label.x < length / 2 ? 1 : -1;
      const nudge = isEnd ? unitSize * 0.6 * inward : 0;
      // En una barra más vertical que horizontal, centrado el número cruza su
      // propia barra: se ancla por el lado que da a ella y crece hacia afuera
      // (la misma regla de `axialLabelPoint`). En una más horizontal, el número
      // de un extremo crece **hacia adentro**: centrado sobre la esquina
      // cruzaba la columna que llega ahí.
      const away = { x: normal.x * out, y: normal.y * out };
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
      wanted.push({
        away,
        label: {
          x: p.x + away.x * unitSize * 0.8 + along.x * nudge,
          y: p.y + away.y * unitSize * 0.8 + along.y * nudge,
          anchor,
          text: scale.format(unsigned ? Math.abs(label.value) : label.value, decimals),
        },
      });
    }
  }

  // ── Segunda pasada: cada número que choca con uno ya puesto se aleja ─────
  // Se vio en el pórtico a dos aguas: el momento de la cumbrera y los máximos
  // de las dos vigas, a menos de una unidad, escritos uno encima del otro.
  const placed: PlacedLabel[] = [];
  for (const { label, away } of wanted) {
    let candidate = label;
    for (let attempt = 0; attempt < 4; attempt++) {
      const box = boxOf(candidate, unitSize);
      const hits = placed.some((other) => {
        const o = boxOf(other, unitSize);
        return o.left < box.right && o.right > box.left && o.top < box.bottom && o.bottom > box.top;
      });
      if (!hits) break;
      candidate = { ...candidate, x: candidate.x + away.x * unitSize * 1.2, y: candidate.y + away.y * unitSize * 1.2 };
    }
    placed.push(candidate);
  }

  // ── El lienzo, con lugar para las curvas y sus números ──────────────────
  // El margen de `computeViewBox` alcanza para las etiquetas de los nudos, no
  // para una curva de 3.5 unidades con su número afuera: el de una columna del
  // borde salía cortado (se leía «.9521»).
  const extents = [
    ...outlines.flatMap((o) => o.points),
    ...placed.flatMap((label) => {
      const box = boxOf(label, unitSize);
      return [
        { x: box.left, y: box.top },
        { x: box.right, y: box.bottom },
      ];
    }),
  ];
  const margin = unitSize * 0.5;
  const minX = Math.min(baseViewBox.minX, ...extents.map((p) => p.x - margin));
  const minY = Math.min(baseViewBox.minY, ...extents.map((p) => p.y - margin));
  const maxX = Math.max(baseViewBox.minX + baseViewBox.width, ...extents.map((p) => p.x + margin));
  const maxY = Math.max(baseViewBox.minY + baseViewBox.height, ...extents.map((p) => p.y + margin));
  const viewBox: ViewBox = { minX, minY, width: maxX - minX, height: maxY - minY };

  return (
    <SvgCanvas viewBox={viewBox} className={className}>
      {outlines.map((outline) => (
        <polygon
          key={outline.id}
          points={outline.points.map((p) => `${p.x},${p.y}`).join(" ")}
          className={FILL}
          strokeWidth={1.25}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {placed.map((label, i) => (
        <DiagramLabel key={i} x={label.x} y={label.y} unitSize={unitSize} anchor={label.anchor} className={TEXT}>
          {label.text}
        </DiagramLabel>
      ))}

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

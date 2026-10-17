"use client";

import { useDecimals } from "@/components/custom/decimals-scope";
import { DiagramLabel } from "./diagram-label";
import { MomentArc } from "./moment-arc";
import { useDiagramScale } from "./scale-context";
import type { DiagramMemberLoad, DiagramNode } from "./types";
import { projectPoint, type SvgPoint } from "./viewbox";

/** El mismo azul que las cargas nodales: es un dato del alumno, no una salida del cálculo. */
const COLOR_CLASS = "stroke-blue-600 fill-blue-600 dark:stroke-blue-500 dark:fill-blue-500";

interface MemberLoadGlyphProps {
  load: DiagramMemberLoad;
  from: DiagramNode;
  to: DiagramNode;
  unitSize: number;
}

/** Triángulo de la punta, con el vértice en `tip` apuntando según `dir` (unitario, en coordenadas SVG). */
function ArrowHead({ tip, dir, size }: { tip: SvgPoint; dir: SvgPoint; size: number }) {
  const base = { x: tip.x - dir.x * size * 1.6, y: tip.y - dir.y * size * 1.6 };
  const perp = { x: -dir.y, y: dir.x };
  return (
    // Maciza: sin `stroke-none` hereda el trazo del grupo con el ancho inicial
    // (1 unidad del modelo, no 1 px).
    <polygon
      points={`${tip.x},${tip.y} ${base.x + perp.x * size},${base.y + perp.y * size} ${base.x - perp.x * size},${base.y - perp.y * size}`}
      className="stroke-none"
    />
  );
}

function Arrow({ tail, tip, unitSize }: { tail: SvgPoint; tip: SvgPoint; unitSize: number }) {
  const length = Math.hypot(tip.x - tail.x, tip.y - tail.y);
  if (length < unitSize * 0.15) return null;
  const dir = { x: (tip.x - tail.x) / length, y: (tip.y - tail.y) / length };
  // Una flecha corta con la punta entera se vuelve solo punta: se achica con ella.
  const size = Math.min(unitSize * 0.3, length * 0.3);
  return (
    <>
      <line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <ArrowHead tip={tip} dir={dir} size={size} />
    </>
  );
}

/**
 * De qué lado de la barra quedan las flechas de una carga, en coordenadas SVG
 * (`null` si no ocupan ninguno: un momento, o una carga paralela a la barra).
 * Lo usa el esquema para poner el nombre de la barra del otro lado.
 */
export function memberLoadSide(load: DiagramMemberLoad, from: DiagramNode, to: DiagramNode): SvgPoint | null {
  if (load.kind === "moment") return null;
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  if (length === 0) return null;
  const d = { x: load.direction.x, y: -load.direction.z };
  const barDir = { x: (to.x - from.x) / length, y: -(to.z - from.z) / length };
  if (Math.abs(d.x * barDir.y - d.y * barDir.x) < 0.2) return null;
  // Las colas van en contra de la carga; si cambia de signo, manda la mayor.
  const q = Math.abs(load.q1) >= Math.abs(load.q2) ? load.q1 : load.q2;
  const sign = Math.sign(q);
  return sign === 0 ? null : { x: -sign * d.x, y: -sign * d.y };
}

/**
 * Una carga a lo largo de una barra, dibujada como en el pizarrón.
 *
 * - **Puntual**: una flecha que **llega** a la barra (la nodal sale del nudo,
 *   porque ahí no hay nada que tocar; acá la flecha apunta a donde se aplica).
 * - **Distribuida**: una fila de flechas que llegan a la barra con la
 *   envolvente por las colas, cada una proporcional a la intensidad en su
 *   punto — así una triangular se ve triangular. Si la carga va a lo largo de
 *   la barra (axial, o vertical sobre una columna), las flechas no tendrían
 *   dónde apoyarse: van paralelas, corridas al costado.
 * - **Momento**: el mismo arco que un momento nodal, sobre el punto de la barra.
 */
export function MemberLoadGlyph({ load, from, to, unitSize }: MemberLoadGlyphProps) {
  const decimals = useDecimals();
  const scale = useDiagramScale();

  const length = Math.hypot(to.x - from.x, to.z - from.z);
  if (length === 0) return null;
  const along = (s: number) => ({
    x: from.x + ((to.x - from.x) * s) / length,
    z: from.z + ((to.z - from.z) * s) / length,
  });
  const label = (value: number) => `${scale.format(value, decimals)}${load.projected ? " por planta" : ""}`;

  if (load.kind === "moment") {
    if (load.q1 === 0) return null;
    const p = along(load.a);
    return <MomentArc x={p.x} z={p.z} value={load.q1} unitSize={unitSize} variant="force" />;
  }

  // Dirección de la carga en coordenadas SVG (y hacia abajo).
  const d = { x: load.direction.x, y: -load.direction.z };
  const barDir = { x: (to.x - from.x) / length, y: -(to.z - from.z) / length };

  if (load.kind === "point") {
    if (load.q1 === 0) return null;
    const sign = Math.sign(load.q1);
    const tip = projectPoint(along(load.a));
    const reach = unitSize * 2.2;
    const tail = { x: tip.x - sign * d.x * reach, y: tip.y - sign * d.y * reach };
    return (
      <g className={COLOR_CLASS}>
        <Arrow tail={tail} tip={tip} unitSize={unitSize} />
        <DiagramLabel
          x={tail.x - sign * d.x * unitSize * 0.7}
          y={tail.y - sign * d.y * unitSize * 0.7}
          unitSize={unitSize}
        >
          {label(load.q1)}
        </DiagramLabel>
      </g>
    );
  }

  const qMax = Math.max(Math.abs(load.q1), Math.abs(load.q2));
  if (qMax === 0 || load.b <= load.a) return null;
  const q = (s: number) => load.q1 + ((load.q2 - load.q1) * (s - load.a)) / (load.b - load.a);

  // Una flecha cada ~2.5 unidades del dibujo, con un mínimo de tres: con 1.5
  // una viga de 5 m llevaba 17 y se leía como una mancha.
  const count = Math.max(3, Math.round((load.b - load.a) / (unitSize * 2.5)) + 1);
  const stations = Array.from({ length: count }, (_, i) => load.a + ((load.b - load.a) * i) / (count - 1));

  const parallel = Math.abs(d.x * barDir.y - d.y * barDir.x) < 0.2;

  if (parallel) {
    // Al costado de la barra, del lado de su izquierda (`+y'`), con flechas cortas.
    const side = { x: barDir.y, y: -barDir.x };
    const offset = unitSize * 0.8;
    const half = unitSize * 0.45;
    const mid = projectPoint(along((load.a + load.b) / 2));
    return (
      <g className={COLOR_CLASS}>
        {stations.map((s, i) => {
          const value = q(s);
          if (value === 0) return null;
          const sign = Math.sign(value);
          const p = projectPoint(along(s));
          const c = { x: p.x + side.x * offset, y: p.y + side.y * offset };
          return (
            <Arrow
              key={i}
              tail={{ x: c.x - sign * d.x * half, y: c.y - sign * d.y * half }}
              tip={{ x: c.x + sign * d.x * half, y: c.y + sign * d.y * half }}
              unitSize={unitSize}
            />
          );
        })}
        <DiagramLabel
          x={mid.x + side.x * offset * 2.2}
          y={mid.y + side.y * offset * 2.2}
          unitSize={unitSize}
        >
          {load.q1 === load.q2 ? label(load.q1) : `${label(load.q1)} → ${label(load.q2)}`}
        </DiagramLabel>
      </g>
    );
  }

  // Cola de cada flecha: la intensidad con su signo, así una carga que cambia
  // de signo cruza la barra en vez de dibujarse toda del mismo lado.
  const height = unitSize * 1.8;
  const tailAt = (s: number) => {
    const p = projectPoint(along(s));
    const k = (q(s) / qMax) * height;
    return { x: p.x - d.x * k, y: p.y - d.y * k };
  };
  const envelope = stations.map(tailAt);
  // El texto es horizontal y la envolvente sigue a la barra: sobre una barra
  // inclinada, medio texto quedaba encima de las flechas (se vio en el pórtico
  // a dos aguas). La etiqueta se aleja lo que la envolvente sube a lo largo de
  // medio ancho de texto, medido en la dirección de la carga.
  const textHalf = (text: string) => text.length * 0.3 * unitSize;
  const rise = (text: string) =>
    (textHalf(text) * Math.abs(barDir.y) * Math.abs(d.y)) / Math.max(Math.abs(barDir.x), 0.2);
  const labelAt = (s: number, text: string) => {
    const tail = tailAt(s);
    const sign = Math.sign(q(s)) || 1;
    const away = unitSize * 0.7 + rise(text);
    return { x: tail.x - sign * d.x * away, y: tail.y - sign * d.y * away };
  };
  const start = labelAt(load.a, label(load.q1));
  const end = labelAt(load.b, label(load.q2));
  const middle = labelAt((load.a + load.b) / 2, label(load.q1));

  return (
    <g className={COLOR_CLASS}>
      {stations.map((s, i) => (
        <Arrow key={i} tail={envelope[i]} tip={projectPoint(along(s))} unitSize={unitSize} />
      ))}
      <polyline
        points={envelope.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {load.q1 === load.q2 ? (
        <DiagramLabel x={middle.x} y={middle.y} unitSize={unitSize}>
          {label(load.q1)}
        </DiagramLabel>
      ) : (
        <>
          {load.q1 !== 0 && (
            <DiagramLabel x={start.x} y={start.y} unitSize={unitSize}>
              {label(load.q1)}
            </DiagramLabel>
          )}
          {load.q2 !== 0 && (
            <DiagramLabel x={end.x} y={end.y} unitSize={unitSize}>
              {label(load.q2)}
            </DiagramLabel>
          )}
        </>
      )}
    </g>
  );
}

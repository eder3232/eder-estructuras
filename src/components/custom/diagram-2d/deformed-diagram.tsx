"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useDecimals } from "@/components/custom/decimals-scope";
import { Slider } from "@/components/ui/slider";
import { axialLabelPoint } from "./axial-label";
import { DiagramLabel } from "./diagram-label";
import { ForceGlyph } from "./force-glyph";
import { DiagramScaleProvider, useDiagramScale } from "./scale-context";
import { computeUnitSize } from "./unit-scale";
import type { DiagramElement, DiagramForce, DiagramNode } from "./types";
import { computeViewBox, projectPoint, type SvgPoint } from "./viewbox";
import { SvgCanvas } from "./svg-canvas";

interface DeformedDiagramProps {
  nodes: DiagramNode[];
  elements: DiagramElement[];
  /** [dx, dz] por nudo, en las unidades del modelo (sin escalar todavía). */
  displacements: Map<string, [number, number]>;
  reactions: DiagramForce[];
  /** Fuerza interna por elemento (signo: positivo = tracción, negativo = compresión), para el color de cada barra. */
  elementForceValue: Map<string, number>;
  /**
   * Rango del factor de escala. El default sirve para una deformada real, donde
   * los desplazamientos son de 10⁻³ y hay que multiplicarlos por decenas para
   * ver algo. **No sirve para un desplazamiento impuesto de 1**, que es el caso
   * del explorador de columnas de K: ahí el factor útil está cerca de 1 y con
   * 50 la estructura se dibuja deformada cincuenta veces su tamaño.
   */
  scale?: { initial?: number; max?: number; step?: number };
  /**
   * Si se escribe el número de las barras con fuerza nula.
   *
   * En la deformada real conviene que sí: una barra de fuerza cero es un
   * concepto con nombre propio en armaduras, no un hueco. En el explorador de
   * columnas de `K`, en cambio, **la mayoría de las barras dan cero** —solo se
   * estiran las que tocan el nudo que se movió— y una docena de `0.0000`
   * superpuestos tapa justamente los números que importan.
   */
  showZeroAxialLabels?: boolean;
  /** Reemplaza la leyenda de abajo, que describe qué significa cada trazo. */
  legend?: ReactNode;
  /**
   * La forma de cada barra **entre** sus nudos, para los pórticos: puntos de la
   * barra sin deformar (`x`, `z`) y su desplazamiento (`dx`, `dz`), sin escalar.
   * Una barra que no esté acá se dibuja recta entre sus nudos, como en una
   * armadura — donde eso es exacto.
   */
  elementShapes?: Map<string, { x: number; z: number; dx: number; dz: number }[]>;
  /**
   * Colorear cada barra por el signo de su axial y escribir el número. En una
   * armadura la axial es una sola por barra; en un pórtico con cargas axiales
   * varía a lo largo de ella y tiene su propio diagrama, así que ahí la
   * deformada muestra solo la forma.
   */
  colorByForce?: boolean;
}

const DEFAULT_SCALE = { initial: 50, max: 500, step: 10 };

const ZERO_THRESHOLD = 1e-6;

/** Tracción, compresión o barra descargada — el mismo criterio para la barra y para su número. */
function state(force: number | undefined): "zero" | "tension" | "compression" {
  if (force === undefined || Math.abs(force) < ZERO_THRESHOLD) return "zero";
  return force > 0 ? "tension" : "compression";
}

/**
 * El verde de tracción **cambia de tono por tema**, medido con la razón de
 * contraste WCAG contra el fondo: `emerald-500` da 8.0:1 en oscuro pero 2.46:1
 * en claro, o sea que el valor de una barra traccionada no se leía en claro.
 * El número va un tono más oscuro que la barra (`700`, 5.4:1) porque a texto se
 * le piden 4.5 y a un trazo 3 (`600`, 3.7:1).
 */
const STROKE_CLASS = {
  zero: "stroke-muted-foreground",
  tension: "stroke-emerald-600 dark:stroke-emerald-500",
  compression: "stroke-destructive",
} as const;

const FILL_CLASS = {
  zero: "fill-muted-foreground",
  tension: "fill-emerald-700 dark:fill-emerald-500",
  compression: "fill-destructive",
} as const;

/**
 * El factor común de los números del dibujo sale de **todo** lo que se va a
 * escribir —reacciones y fuerzas axiales—, así que se calcula acá afuera y el
 * cuerpo del diagrama lo consume por contexto (ver `scale-context.tsx`).
 */
export function DeformedDiagram(props: DeformedDiagramProps) {
  const values = [...props.reactions.map((r) => r.value), ...props.elementForceValue.values()];

  return (
    <DiagramScaleProvider values={values}>
      <DeformedDiagramBody {...props} />
    </DiagramScaleProvider>
  );
}

function DeformedDiagramBody({
  nodes,
  elements,
  displacements,
  reactions,
  elementForceValue,
  scale,
  showZeroAxialLabels = true,
  legend,
  elementShapes,
  colorByForce = true,
}: DeformedDiagramProps) {
  const { initial, max, step } = { ...DEFAULT_SCALE, ...scale };
  const [scaleFactor, setScaleFactor] = useState(initial);
  const animation = useRef<number | null>(null);

  // Solo limpieza: el efecto no toca estado, así que no roza la regla
  // `react-hooks/set-state-in-effect`.
  useEffect(() => () => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
  }, []);
  const decimals = useDecimals();
  const numberScale = useDiagramScale();

  if (nodes.length === 0) return null;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const displacedById = new Map(
    nodes.map((n) => {
      const [dx, dz] = displacements.get(n.id) ?? [0, 0];
      return [n.id, { x: n.x + dx * scaleFactor, z: n.z + dz * scaleFactor }];
    }),
  );

  const displacedShapes = new Map<string, SvgPoint[]>(
    [...(elementShapes ?? [])].map(([id, points]) => [
      id,
      points.map((p) => projectPoint({ x: p.x + p.dx * scaleFactor, z: p.z + p.dz * scaleFactor })),
    ]),
  );

  const originalPoints: SvgPoint[] = nodes.map((n) => projectPoint(n));
  const displacedPoints: SvgPoint[] = [
    ...[...displacedById.values()].map(projectPoint),
    ...[...displacedShapes.values()].flat(),
  ];
  const viewBox = computeViewBox([...originalPoints, ...displacedPoints]);
  const unitSize = computeUnitSize(viewBox);
  const nodeRadius = unitSize * 0.3;
  const center = { x: viewBox.minX + viewBox.width / 2, y: viewBox.minY + viewBox.height / 2 };

  /**
   * Lleva la deformación de 0 al valor actual.
   *
   * Una deformada dibujada quieta se lee como una figura; animada se lee como
   * un movimiento, que es lo que en realidad es. Sirve igual para la forma
   * deformada real y para el desplazamiento unitario del explorador de columnas.
   *
   * El bucle va con `requestAnimationFrame` desde el handler del click y
   * **nunca** con `setState` dentro de un `useEffect`: eso es exactamente la
   * regla `react-hooks/set-state-in-effect`, y este repo tiene 2 errores de lint
   * preexistentes que se usan como referencia de "no hay ninguno nuevo".
   */
  function play() {
    const target = scaleFactor || initial;
    if (animation.current !== null) cancelAnimationFrame(animation.current);

    // Quien pidió menos movimiento no quiere una animación: se salta al final.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setScaleFactor(target);
      return;
    }

    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - (1 - t) ** 3;
      setScaleFactor(Number((target * eased).toFixed(2)));
      animation.current = t < 1 ? requestAnimationFrame(frame) : null;
    };

    setScaleFactor(0);
    animation.current = requestAnimationFrame(frame);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm">
        <Button
          size="icon"
          variant="outline"
          className="size-7"
          onClick={play}
          aria-label="Animar la deformación desde cero"
          title="Animar la deformación desde cero"
        >
          <Play className="size-3.5" />
        </Button>
        <span className="tabular-nums">Factor de escala: {scaleFactor}</span>
        <Slider
          value={[scaleFactor]}
          onValueChange={(value) => setScaleFactor(value[0])}
          min={0}
          max={max}
          step={step}
          className="w-64"
        />
      </div>

      <SvgCanvas viewBox={viewBox}>
        <g className="stroke-muted-foreground" strokeWidth={1} strokeDasharray="4 3">
          {elements.map((element) => {
            const from = nodesById.get(element.fromNodeId);
            const to = nodesById.get(element.toNodeId);
            if (!from || !to) return null;
            const a = projectPoint(from);
            const b = projectPoint(to);
            return <line key={element.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />;
          })}
        </g>

        <g strokeWidth={2}>
          {elements.map((element) => {
            const strokeClass = colorByForce
              ? STROKE_CLASS[state(elementForceValue.get(element.id))]
              : "stroke-foreground";
            const shape = displacedShapes.get(element.id);
            if (shape) {
              return (
                <polyline
                  key={element.id}
                  points={shape.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  strokeLinejoin="round"
                  className={strokeClass}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            const from = displacedById.get(element.fromNodeId);
            const to = displacedById.get(element.toNodeId);
            if (!from || !to) return null;
            const a = projectPoint(from);
            const b = projectPoint(to);
            return (
              <line
                key={element.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={strokeClass}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>

        {colorByForce && elements.map((element) => {
          const from = displacedById.get(element.fromNodeId);
          const to = displacedById.get(element.toNodeId);
          if (!from || !to) return null;
          const force = elementForceValue.get(element.id);
          if (force === undefined) return null;
          if (!showZeroAxialLabels && state(force) === "zero") return null;
          const { x, y, anchor } = axialLabelPoint(projectPoint(from), projectPoint(to), unitSize, center);
          return (
            <DiagramLabel
              key={element.id}
              x={x}
              y={y}
              unitSize={unitSize}
              anchor={anchor}
              className={FILL_CLASS[state(force)]}
            >
              {numberScale.format(force, decimals)}
            </DiagramLabel>
          );
        })}

        {[...displacedById.entries()].map(([nodeId, point]) => {
          const { x, y } = projectPoint(point);
          return <circle key={nodeId} cx={x} cy={y} r={nodeRadius} className="fill-primary" />;
        })}

        {reactions.map((reaction, i) => (
          <ForceGlyph
            key={`${reaction.nodeId}-${reaction.axis}-${i}`}
            force={reaction}
            unitSize={unitSize}
            variant="reaction"
          />
        ))}
      </SvgCanvas>

      <p className="text-xs text-muted-foreground">
        {numberScale.factor && (
          <>
            Todos los valores del dibujo van <span className="tabular-nums">{numberScale.factor}</span>.{" "}
          </>
        )}
        {legend ?? (
          <>
            Línea punteada: forma original. Línea sólida: forma desplazada (escalada). Verde = tracción, rojo =
            compresión. El número sobre cada barra es su fuerza axial. Flechas: reacciones en los apoyos.
          </>
        )}
      </p>
    </div>
  );
}

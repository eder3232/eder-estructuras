"use client";

import { useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";

import {
  localDirection,
  type DiagramValues,
  type MemberAxis,
  type MemberDiagram,
  type MemberLoad,
} from "@/lib/engine";
import { useDecimals } from "@/components/custom/decimals-scope";
import { DiagramLabel } from "@/components/custom/diagram-2d/diagram-label";
import { InternalForceDiagram, type MemberCurve } from "@/components/custom/diagram-2d/internal-force-diagram";
import { MemberLoadGlyph } from "@/components/custom/diagram-2d/member-load-glyph";
import { DiagramScaleProvider, useDiagramScale } from "@/components/custom/diagram-2d/scale-context";
import type { DiagramMemberLoad, DiagramSupport } from "@/components/custom/diagram-2d/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";
import { useFrame2DView } from "../../frame2d-view";

type Quantity = keyof DiagramValues;

const QUANTITY: Record<Quantity, { title: string; side: "+y" | "-y"; rule: string }> = {
  N: { title: "Fuerza axial (N)", side: "+y", rule: "positiva en tracción" },
  V: {
    title: "Fuerza cortante (V)",
    side: "+y",
    rule: "positivo si hace girar el tramo en sentido horario",
  },
  M: {
    title: "Momento flector (M)",
    side: "-y",
    rule: "positivo si tracciona la fibra de abajo; se dibuja del lado traccionado",
  },
};

/**
 * La curva de un esfuerzo y dónde rotularla: extremos, los dos lados de un
 * salto y, en M, los máximos.
 *
 * **Un esfuerzo constante en toda la barra se escribe una vez, a mitad de
 * ella**, como en los textos. Con un número en cada extremo, los dos caían en
 * las esquinas del pórtico, justo donde llegan los de la barra vecina: medido
 * en el ejemplo inicial, cuatro números de N se pisaban entre sí.
 */
function curveOf(diagram: MemberDiagram, quantity: Quantity): MemberCurve {
  const points = diagram.points.map((p) => ({ x: p.x, value: p[quantity] }));
  const max = Math.max(...points.map((p) => Math.abs(p.value)));
  if (points.every((p) => Math.abs(p.value - points[0].value) <= 1e-9 * (1 + max))) {
    return { points, labels: [{ x: diagram.length / 2, value: points[0].value }] };
  }

  const labels = diagram.keyPoints.flatMap((key) => {
    if (key.kind === "extremum") return quantity === "M" ? [{ x: key.x, value: key.left.M }] : [];
    if (key.kind === "end") return [{ x: key.x, value: key.left[quantity] }];
    const [l, r] = [key.left[quantity], key.right[quantity]];
    const jumps = Math.abs(l - r) > 1e-9 * (1 + Math.abs(l));
    if (jumps) return [{ x: key.x, value: l }, { x: key.x, value: r }];
    // El momento bajo una carga puntual no salta —el que salta es V— y ahí
    // suele estar el máximo: V cruza el cero de golpe, sin pasar por él, así
    // que no es un «extremo» de V = 0. Sin esto el pórtico isostático mostraba
    // un solo número de momento y no el mayor (42.67, bajo la carga de la viga).
    return quantity === "M" ? [{ x: key.x, value: l }] : [];
  });
  return { points, labels };
}

/** Una carga en los ejes de su propia barra, para dibujarla sobre la barra aislada. */
function toLocalGlyph(load: MemberLoad, axis: MemberAxis, i: number): DiagramMemberLoad {
  if (load.kind === "moment") {
    return { id: String(i), elementId: "", kind: "moment", direction: { x: 0, z: 0 }, q1: load.value, q2: 0, a: load.a, b: load.a };
  }
  const [ux, uy] = localDirection(load.direction, axis);
  const direction = { x: ux, z: uy };
  if (load.kind === "point") {
    return { id: String(i), elementId: "", kind: "point", direction, q1: load.value, q2: 0, a: load.a, b: load.a };
  }
  // Como la escribió el alumno, marcada si es por planta: el número del dibujo
  // tiene que poder buscarse en la tabla (ver el esquema).
  return {
    id: String(i),
    elementId: "",
    kind: "distributed",
    direction,
    q1: load.q1,
    q2: load.q2,
    a: load.a,
    b: load.b,
    projected: load.projected,
  };
}

export function MemberDiagrams({ elements, nodesById }: { elements: ElementRow[]; nodesById: Map<string, NodeRow> }) {
  const { atomMemberDiagrams, atomMemberLoads } = useFrame2DView();
  const diagrams = useAtomValue(atomMemberDiagrams);
  const { loadsByElement, axisByElement } = useAtomValue(atomMemberLoads);
  const [quantity, setQuantity] = useState<Quantity>("M");
  const drawable = elements.filter((e) => diagrams.get(e.id)?.status === "ok");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const selected = drawable.find((e) => e.id === selectedId) ?? drawable[0];
  const manual = elements.filter((e) => diagrams.get(e.id)?.status === "manual-fem");

  const nodes = [...nodesById.values()];
  const supports: DiagramSupport[] = nodes
    .filter((n) => n.restrainedX || n.restrainedZ || n.restrainedR)
    .map((n) => ({
      nodeId: n.id,
      x: n.x,
      z: n.z,
      restrainedX: n.restrainedX,
      restrainedZ: n.restrainedZ,
      restrainedRotation: n.restrainedR,
    }));

  const curves = new Map<string, MemberCurve>();
  for (const element of drawable) {
    const result = diagrams.get(element.id);
    if (result?.status === "ok") curves.set(element.id, curveOf(result.diagram, quantity));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Los esfuerzos <strong>a lo largo de cada barra</strong>, no solo en sus extremos. Se calculan por estática
          del tramo: a las fuerzas del extremo «desde» se les suman las cargas hasta el punto. No se integra nada
          numéricamente, así que los saltos de una carga puntual y el máximo del momento —donde el corte se hace
          cero— son exactos.
        </p>
        <p>
          Convención de los textos (Hibbeler, Beer), con cada barra mirada de «desde» a «hacia»: N{" "}
          {QUANTITY.N.rule}; V {QUANTITY.V.rule}; M {QUANTITY.M.rule}. N y V positivos se dibujan del lado izquierdo
          de la barra (<code>+y′</code>). En el momento, dibujado del lado traccionado, <strong>el lado ya dice el
          signo</strong> y el pórtico lo escribe sin él: con signo, el mismo momento cambiaba según hacia dónde se
          dibujó cada barra. La barra aislada y las tablas sí lo llevan.
        </p>
        {manual.length > 0 && (
          <p>
            <strong>Sin diagrama:</strong> {manual.map((e) => e.name).join(", ")}, porque{" "}
            {manual.length === 1 ? "tiene" : "tienen"} el FEM escrito a mano. El FEM dice qué pasa en los extremos,
            pero no cómo está repartida la carga entre ellos, y sin eso no hay con qué dibujar el interior.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Qué esfuerzo dibujar">
          {(Object.keys(QUANTITY) as Quantity[]).map((q) => (
            <Button
              key={q}
              size="sm"
              variant={q === quantity ? "default" : "outline"}
              aria-pressed={q === quantity}
              onClick={() => setQuantity(q)}
            >
              {QUANTITY[q].title}
            </Button>
          ))}
        </div>
        <InternalForceDiagram
          nodes={nodes}
          elements={elements}
          supports={supports}
          curves={curves}
          positiveSide={QUANTITY[quantity].side}
          mergeJointLabels={quantity === "M"}
          unsigned={quantity === "M"}
        />
      </div>

      {selected && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-semibold">Una barra aislada</h3>
            <Select value={selected.id} onValueChange={setSelectedId}>
              <SelectTrigger className="w-28" aria-label="Barra a mostrar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {drawable.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            Como en el libro: la barra horizontal, de «desde» (izquierda) a «hacia» (derecha), con sus cargas arriba
            y los tres diagramas debajo, alineados. Pasá el mouse para leer los tres esfuerzos en un punto.
          </p>
          <IsolatedMember
            key={selected.id}
            name={selected.name}
            fromName={nodesById.get(selected.fromNodeId)?.name ?? ""}
            toName={nodesById.get(selected.toNodeId)?.name ?? ""}
            diagram={(diagrams.get(selected.id) as { status: "ok"; diagram: MemberDiagram }).diagram}
            loads={(loadsByElement.get(selected.id) ?? []).map((l, i) => toLocalGlyph(l, axisByElement.get(selected.id)!, i))}
          />
        </div>
      )}
    </div>
  );
}

interface IsolatedMemberProps {
  name: string;
  fromName: string;
  toName: string;
  diagram: MemberDiagram;
  loads: DiagramMemberLoad[];
}

function IsolatedMember(props: IsolatedMemberProps) {
  const { diagram } = props;
  const values = diagram.keyPoints.flatMap((k) => [k.left.N, k.left.V, k.left.M, k.right.N, k.right.V, k.right.M]);
  return (
    <DiagramScaleProvider values={values}>
      <IsolatedMemberCanvas {...props} />
    </DiagramScaleProvider>
  );
}

/**
 * La barra aislada y sus tres diagramas, cada uno con **su propia escala**
 * (comparar alturas entre N y M no significa nada: son magnitudes distintas).
 * El momento positivo va **abajo**: es el lado traccionado, igual que en el
 * pórtico de arriba, para que las dos vistas digan lo mismo.
 */
function IsolatedMemberCanvas({ name, fromName, toName, diagram, loads }: IsolatedMemberProps) {
  const decimals = useDecimals();
  const scale = useDiagramScale();
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<number | null>(null);

  const L = diagram.length;
  const width = L * 1.3;
  const unitSize = width / 50;
  // La franja de la barra solo es alta si tiene cargas que dibujar arriba.
  const stripHeight = L * 0.24;
  const barStrip = loads.length > 0 ? L * 0.3 : unitSize * 4;
  const barY = loads.length > 0 ? barStrip * 0.75 : barStrip / 2;
  const top = { N: barStrip, V: barStrip + stripHeight, M: barStrip + stripHeight * 2 };
  const totalHeight = barStrip + stripHeight * 3;
  const amplitude = stripHeight * 0.3;
  const minX = -L * 0.15;

  const maxOf = useMemo(() => {
    const max = (q: Quantity) => Math.max(0, ...diagram.points.map((p) => Math.abs(p[q])));
    return { N: max("N"), V: max("V"), M: max("M") };
  }, [diagram]);

  const toSvgX = (clientX: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const point = new DOMPoint(clientX, 0).matrixTransform(ctm.inverse());
    return point.x;
  };

  const strip = (q: Quantity) => {
    const axisY = top[q] + stripHeight / 2;
    const factor = maxOf[q] > 0 ? amplitude / maxOf[q] : 0;
    // Pantalla con y hacia abajo: N y V positivos suben; M positivo baja (lado traccionado).
    const direction = q === "M" ? 1 : -1;
    const y = (value: number) => axisY + direction * value * factor;
    const curve = curveOf(diagram, q);
    const outline = [
      { x: 0, y: axisY },
      ...curve.points.map((p) => ({ x: p.x, y: y(p.value) })),
      { x: L, y: axisY },
    ];
    const negligible = maxOf[q] * 1e-9;
    return (
      <g key={q}>
        <DiagramLabel x={minX + unitSize} y={axisY} unitSize={unitSize * 1.1} anchor="start" className="fill-foreground">
          {q}
        </DiagramLabel>
        <polygon
          points={outline.map((p) => `${p.x},${p.y}`).join(" ")}
          className="fill-violet-500/15 stroke-violet-600 dark:fill-violet-400/20 dark:stroke-violet-400"
          strokeWidth={1.25}
          vectorEffect="non-scaling-stroke"
        />
        <line x1={0} y1={axisY} x2={L} y2={axisY} className="stroke-foreground" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {curve.labels
          .filter((label) => Math.abs(label.value) > negligible)
          .map((label, i) => {
            const out = Math.sign(direction * label.value) || 1;
            const anchor = label.x === 0 ? "start" : label.x === L ? "end" : "middle";
            return (
              <DiagramLabel
                key={i}
                x={label.x}
                y={y(label.value) + out * unitSize * 0.9}
                unitSize={unitSize}
                anchor={anchor}
                className="fill-violet-700 dark:fill-violet-300"
              >
                {scale.format(label.value, decimals)}
              </DiagramLabel>
            );
          })}
      </g>
    );
  };

  const reading = cursor === null ? null : diagram.at(cursor);

  return (
    <div className="flex max-w-3xl flex-col gap-2">
      <div className="rounded-md border bg-muted/20">
        <svg
          ref={svgRef}
          viewBox={`${minX} 0 ${width} ${totalHeight}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label={`Diagramas de la barra ${name}`}
          onPointerMove={(event) => {
            const x = toSvgX(event.clientX);
            setCursor(x === null || x < 0 || x > L ? null : x);
          }}
          onPointerLeave={() => setCursor(null)}
        >
          {/* La barra con sus cargas, en sus ejes: y' hacia arriba. */}
          <g transform={`translate(0 ${barY})`}>
            <line x1={0} y1={0} x2={L} y2={0} className="stroke-foreground" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <DiagramLabel x={-unitSize * 0.8} y={0} unitSize={unitSize} anchor="end" className="fill-foreground">
              {fromName}
            </DiagramLabel>
            <DiagramLabel x={L + unitSize * 0.8} y={0} unitSize={unitSize} anchor="start" className="fill-foreground">
              {toName}
            </DiagramLabel>
            {loads.map((load) => (
              <MemberLoadGlyph key={load.id} load={load} from={{ id: "i", name: "", x: 0, z: 0 }} to={{ id: "j", name: "", x: L, z: 0 }} unitSize={unitSize} />
            ))}
          </g>
          {(["N", "V", "M"] as const).map(strip)}
          {cursor !== null && (
            <line
              x1={cursor}
              y1={top.N}
              x2={cursor}
              y2={totalHeight}
              className="stroke-muted-foreground"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>
      <p className="min-h-5 font-mono text-sm tabular-nums" aria-live="polite">
        {reading && cursor !== null ? (
          <>
            x = {cursor.toFixed(decimals)} · N = {scale.format(reading.N, decimals)} · V ={" "}
            {scale.format(reading.V, decimals)} · M = {scale.format(reading.M, decimals)}
          </>
        ) : (
          <span className="text-muted-foreground">Pasá el mouse sobre los diagramas.</span>
        )}
      </p>
    </div>
  );
}

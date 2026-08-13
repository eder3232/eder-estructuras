"use client";

import { useState } from "react";

import { useDecimals } from "@/components/custom/decimals-scope";
import { Slider } from "@/components/ui/slider";
import { axialLabelPoint } from "./axial-label";
import { DiagramLabel } from "./diagram-label";
import { ForceGlyph } from "./force-glyph";
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
}

const ZERO_THRESHOLD = 1e-6;

/** Tracción, compresión o barra descargada — el mismo criterio para la barra y para su número. */
function state(force: number | undefined): "zero" | "tension" | "compression" {
  if (force === undefined || Math.abs(force) < ZERO_THRESHOLD) return "zero";
  return force > 0 ? "tension" : "compression";
}

const STROKE_CLASS = {
  zero: "stroke-muted-foreground",
  tension: "stroke-emerald-500",
  compression: "stroke-destructive",
} as const;

const FILL_CLASS = {
  zero: "fill-muted-foreground",
  tension: "fill-emerald-500",
  compression: "fill-destructive",
} as const;

export function DeformedDiagram({ nodes, elements, displacements, reactions, elementForceValue }: DeformedDiagramProps) {
  const [scaleFactor, setScaleFactor] = useState(50);
  const decimals = useDecimals();

  if (nodes.length === 0) return null;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const displacedById = new Map(
    nodes.map((n) => {
      const [dx, dz] = displacements.get(n.id) ?? [0, 0];
      return [n.id, { x: n.x + dx * scaleFactor, z: n.z + dz * scaleFactor }];
    }),
  );

  const originalPoints: SvgPoint[] = nodes.map((n) => projectPoint(n));
  const displacedPoints: SvgPoint[] = [...displacedById.values()].map(projectPoint);
  const viewBox = computeViewBox([...originalPoints, ...displacedPoints]);
  const unitSize = computeUnitSize(viewBox);
  const nodeRadius = unitSize * 0.3;
  const center = { x: viewBox.minX + viewBox.width / 2, y: viewBox.minY + viewBox.height / 2 };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm">
        <span>Factor de escala: {scaleFactor}</span>
        <Slider
          value={[scaleFactor]}
          onValueChange={(value) => setScaleFactor(value[0])}
          min={0}
          max={500}
          step={10}
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
                className={STROKE_CLASS[state(elementForceValue.get(element.id))]}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>

        {elements.map((element) => {
          const from = displacedById.get(element.fromNodeId);
          const to = displacedById.get(element.toNodeId);
          if (!from || !to) return null;
          const force = elementForceValue.get(element.id);
          if (force === undefined) return null;
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
              {force.toFixed(decimals)}
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
        Línea punteada: forma original. Línea sólida: forma desplazada (escalada). Verde = tracción, rojo =
        compresión. El número sobre cada barra es su fuerza axial. Flechas: reacciones en los apoyos.
      </p>
    </div>
  );
}

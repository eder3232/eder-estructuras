"use client";

import { useMemo, useState } from "react";
import { Line } from "@react-three/drei";

import { Slider } from "@/components/ui/slider";
import { computeBounds, computeUnitSize } from "./bounds";
import { ForceArrow3D } from "./force-arrow-3d";
import { SceneCanvas } from "./scene-canvas";
import { useDiagramColors } from "./theme-colors";
import type { Diagram3DElement, Diagram3DForce, Diagram3DNode, Point3 } from "./types";

interface DeformedSceneProps {
  nodes: Diagram3DNode[];
  elements: Diagram3DElement[];
  /** [dx, dy, dz] por nudo, en unidades del modelo (sin escalar todavía). */
  displacements: Map<string, Point3>;
  reactions: Diagram3DForce[];
  /** Fuerza interna por elemento (positivo = tracción), para el color de cada barra. */
  elementForceValue: Map<string, number>;
}

const ZERO_THRESHOLD = 1e-6;
const TENSION_GREEN = 0x10b981;

export function DeformedScene({
  nodes,
  elements,
  displacements,
  reactions,
  elementForceValue,
}: DeformedSceneProps) {
  const [scaleFactor, setScaleFactor] = useState(50);
  const colors = useDiagramColors();

  const displacedById = useMemo(() => {
    return new Map<string, Point3>(
      nodes.map((n) => {
        const [dx, dy, dz] = displacements.get(n.id) ?? [0, 0, 0];
        return [n.id, [n.x + dx * scaleFactor, n.y + dy * scaleFactor, n.z + dz * scaleFactor] as Point3];
      }),
    );
  }, [nodes, displacements, scaleFactor]);

  const points: Point3[] = useMemo(
    () => [...nodes.map((n) => [n.x, n.y, n.z] as Point3), ...displacedById.values()],
    [nodes, displacedById],
  );

  if (nodes.length === 0) return null;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const unitSize = computeUnitSize(computeBounds(points));

  /** Mismo criterio que en 2D: el color dice tracción/compresión, no magnitud. */
  const barColor = (force: number | undefined) => {
    if (force === undefined || Math.abs(force) < ZERO_THRESHOLD) return colors.mutedForeground;
    return force > 0 ? TENSION_GREEN : colors.destructive;
  };

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

      <SceneCanvas points={points}>
        {elements.map((element) => {
          const from = nodesById.get(element.fromNodeId);
          const to = nodesById.get(element.toNodeId);
          if (!from || !to) return null;
          return (
            <Line
              key={`${element.id}-original`}
              points={[
                [from.x, from.y, from.z],
                [to.x, to.y, to.z],
              ]}
              color={colors.mutedForeground}
              lineWidth={1}
              dashed
              dashSize={unitSize}
              gapSize={unitSize * 0.8}
            />
          );
        })}

        {elements.map((element) => {
          const from = displacedById.get(element.fromNodeId);
          const to = displacedById.get(element.toNodeId);
          if (!from || !to) return null;
          return (
            <Line
              key={element.id}
              points={[from, to]}
              color={barColor(elementForceValue.get(element.id))}
              lineWidth={3}
            />
          );
        })}

        {[...displacedById.entries()].map(([nodeId, position]) => (
          <mesh key={nodeId} position={position}>
            <sphereGeometry args={[unitSize * 0.4, 16, 16]} />
            <meshStandardMaterial color={colors.primary} />
          </mesh>
        ))}

        {reactions.map((reaction, i) => (
          <ForceArrow3D
            key={`${reaction.nodeId}-${reaction.axis}-${i}`}
            origin={[reaction.x, reaction.y, reaction.z]}
            axis={reaction.axis}
            value={reaction.value}
            unitSize={unitSize}
            variant="reaction"
            color={colors.warning}
          />
        ))}
      </SceneCanvas>

      <p className="text-xs text-muted-foreground">
        Línea punteada: forma original. Línea sólida: forma desplazada (escalada). Verde = tracción, rojo =
        compresión. Flechas: reacciones en los apoyos, dibujadas sobre la posición original del nudo.
      </p>
    </div>
  );
}

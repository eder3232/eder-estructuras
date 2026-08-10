"use client";

import { useMemo } from "react";
import { Html, Line } from "@react-three/drei";

import { computeBounds, computeUnitSize } from "./bounds";
import { ForceArrow3D } from "./force-arrow-3d";
import { SceneCanvas } from "./scene-canvas";
import { SupportGlyph3D } from "./support-glyph-3d";
import { readDiagramColors } from "./theme-colors";
import type { Diagram3DElement, Diagram3DForce, Diagram3DNode, Diagram3DSupport, Point3 } from "./types";

interface SchemaSceneProps {
  nodes: Diagram3DNode[];
  elements: Diagram3DElement[];
  supports: Diagram3DSupport[];
  forces: Diagram3DForce[];
}

const FORCE_BLUE = 0x3b82f6;

/**
 * Vista no deformada. Igual que `SchemaDiagram` en 2D, es un preview en vivo:
 * se alimenta de los datos de entrada, no de un `SolveResult`, así que se
 * actualiza mientras el usuario edita — y las barras que todavía no resuelven a
 * un nudo existente simplemente no se dibujan, sin romper el resto.
 */
export function SchemaScene({ nodes, elements, supports, forces }: SchemaSceneProps) {
  const colors = useMemo(() => readDiagramColors(), []);
  const points: Point3[] = useMemo(() => nodes.map((n) => [n.x, n.y, n.z]), [nodes]);

  if (nodes.length === 0) return null;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const bounds = computeBounds(points);
  const unitSize = computeUnitSize(bounds);

  return (
    <SceneCanvas points={points}>
      {elements.map((element) => {
        const from = nodesById.get(element.fromNodeId);
        const to = nodesById.get(element.toNodeId);
        if (!from || !to) return null;
        const a: Point3 = [from.x, from.y, from.z];
        const b: Point3 = [to.x, to.y, to.z];
        const label: Point3 = [
          a[0] + 0.3 * (b[0] - a[0]),
          a[1] + 0.3 * (b[1] - a[1]),
          a[2] + 0.3 * (b[2] - a[2]),
        ];

        return (
          <group key={element.id}>
            <Line points={[a, b]} color={colors.foreground} lineWidth={2.5} />
            <Html position={label} center style={{ pointerEvents: "none" }}>
              <span className="rounded bg-background/80 px-1 text-[10px] text-foreground">{element.name}</span>
            </Html>
          </group>
        );
      })}

      {nodes.map((node) => (
        <group key={node.id}>
          <mesh position={[node.x, node.y, node.z]}>
            <sphereGeometry args={[unitSize * 0.45, 16, 16]} />
            <meshStandardMaterial color={colors.primary} />
          </mesh>
          <Html
            position={[node.x, node.y, node.z + unitSize * 1.4]}
            center
            style={{ pointerEvents: "none" }}
          >
            <span className="rounded bg-background/80 px-1 text-[10px] font-medium text-primary">{node.name}</span>
          </Html>
        </group>
      ))}

      {supports.map((support) => (
        <SupportGlyph3D key={support.nodeId} support={support} unitSize={unitSize} color={colors.mutedForeground} />
      ))}

      {forces.map((force, i) => (
        <ForceArrow3D
          key={`${force.nodeId}-${force.axis}-${i}`}
          origin={[force.x, force.y, force.z]}
          axis={force.axis}
          value={force.value}
          unitSize={unitSize}
          variant="force"
          color={FORCE_BLUE}
        />
      ))}
    </SceneCanvas>
  );
}

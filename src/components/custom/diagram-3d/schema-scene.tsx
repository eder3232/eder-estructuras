"use client";

import { useMemo, useRef } from "react";
import { Html, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";

import type { ModelHighlight } from "@/components/custom/highlight";
import { computeBounds, computeUnitSize } from "./bounds";
import { ForceArrow3D } from "./force-arrow-3d";
import { SceneCanvas } from "./scene-canvas";
import { SupportGlyph3D } from "./support-glyph-3d";
import { useDiagramColors } from "./theme-colors";
import type { Diagram3DElement, Diagram3DForce, Diagram3DNode, Diagram3DSupport, Point3 } from "./types";

/** Cómo se mueve un nudo en un mecanismo; la mayor norma del conjunto vale 1. */
export interface Diagram3DMotion {
  nodeId: string;
  vector: Point3;
}

interface SchemaSceneProps {
  nodes: Diagram3DNode[];
  elements: Diagram3DElement[];
  supports: Diagram3DSupport[];
  forces: Diagram3DForce[];
  /**
   * Qué señalar (N3). Lo señalado queda igual y **el resto se apaga**, el
   * mismo criterio que el esquema 2D: resaltar sin atenuar deja la figura igual
   * de cargada.
   */
  highlight?: ModelHighlight | null;
  /** La otra mitad de N3: señalar desde la escena, para que se encienda la fila. */
  onHighlight?: (highlight: ModelHighlight | null) => void;
  /**
   * Si el modelo es un mecanismo, cómo se mueve sin deformarse. Se dibuja con
   * una flecha por nudo y la figura desplazada en línea de trazos.
   */
  motion?: Diagram3DMotion[];
}

const FORCE_BLUE = 0x3b82f6;
/** El ámbar de las advertencias: un mecanismo es un aviso sobre el modelo, no una carga ni una reacción. */
const MOTION_AMBER = 0xf59e0b;
/**
 * Lo que no está señalado. Medido en el esquema 2D, donde es `opacity-20`.
 *
 * Los materiales que se atenúan van **siempre** con `transparent`, aunque estén
 * a opacidad 1: three.js compila el material con ese valor, y encenderlo
 * después no tiene efecto sin `needsUpdate`. Los apoyos quedaban a plena
 * intensidad sobre una figura apagada.
 */
const DIMMED = 0.2;

/** El giro que lleva el eje +Y local (el de los cilindros y conos de three.js) a `direction`. */
function quaternionTowards(direction: Point3): Quaternion {
  return new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...direction).normalize());
}

/**
 * Vista no deformada. Igual que `SchemaDiagram` en 2D, es un preview en vivo:
 * se alimenta de los datos de entrada, no de un `SolveResult`, así que se
 * actualiza mientras el usuario edita — y las barras que todavía no resuelven a
 * un nudo existente simplemente no se dibujan, sin romper el resto.
 */
export function SchemaScene({ nodes, elements, supports, forces, highlight, onHighlight, motion = [] }: SchemaSceneProps) {
  const colors = useDiagramColors();
  const points: Point3[] = useMemo(() => nodes.map((n) => [n.x, n.y, n.z]), [nodes]);
  // Mientras se rota la cámara el mouse pasa por encima de todo sin querer
  // señalar nada: se ignora. Un ref y no estado, porque no se dibuja.
  const dragging = useRef(false);

  if (nodes.length === 0) return null;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const bounds = computeBounds(points);
  const unitSize = computeUnitSize(bounds);

  const isOn = (kind: "node" | "element", id: string) =>
    !highlight || (kind === "node" ? highlight.nodeIds : highlight.elementIds).includes(id);
  const opacityOf = (kind: "node" | "element", id: string) => (isOn(kind, id) ? 1 : DIMMED);

  const point = (node: Diagram3DNode): Point3 => [node.x, node.y, node.z];

  // La figura desplazada del mecanismo: lo bastante lejos para separarse de la
  // original, sin escala física (un mecanismo no tiene amplitud).
  const motionScale = unitSize * 6;
  const motionByNode = new Map(motion.map((m) => [m.nodeId, m.vector]));
  const moved = (node: Diagram3DNode): Point3 => {
    const v = motionByNode.get(node.id) ?? [0, 0, 0];
    return [node.x + v[0] * motionScale, node.y + v[1] * motionScale, node.z + v[2] * motionScale];
  };

  /**
   * Los manejadores de las zonas sensibles. `stopPropagation`: el rayo del
   * mouse atraviesa todo lo que tiene detrás, y sin cortarlo una barra del
   * fondo se encendería junto con la del frente.
   */
  const pointTo = (target: ModelHighlight) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (!dragging.current) onHighlight?.(target);
  };
  const leave = () => {
    if (!dragging.current) onHighlight?.(null);
  };

  return (
    <SceneCanvas
      points={points}
      onInteractionStart={() => {
        dragging.current = true;
        onHighlight?.(null);
      }}
      onInteractionEnd={() => {
        dragging.current = false;
      }}
    >
      {elements.map((element) => {
        const from = nodesById.get(element.fromNodeId);
        const to = nodesById.get(element.toNodeId);
        if (!from || !to) return null;
        const a = point(from);
        const b = point(to);
        const label: Point3 = [
          a[0] + 0.3 * (b[0] - a[0]),
          a[1] + 0.3 * (b[1] - a[1]),
          a[2] + 0.3 * (b[2] - a[2]),
        ];
        const opacity = opacityOf("element", element.id);
        const pointed = highlight?.elementIds.includes(element.id);

        return (
          <group key={element.id}>
            <Line
              points={[a, b]}
              color={pointed ? colors.primary : colors.foreground}
              lineWidth={pointed ? 5 : 2.5}
              transparent
              opacity={opacity}
            />
            <Html position={label} center style={{ pointerEvents: "none", opacity }}>
              <span className="rounded bg-background/80 px-1 text-xs text-foreground">{element.name}</span>
            </Html>
          </group>
        );
      })}

      {nodes.map((node) => {
        const opacity = opacityOf("node", node.id);
        return (
          <group key={node.id}>
            <mesh position={point(node)}>
              <sphereGeometry args={[unitSize * 0.45, 16, 16]} />
              <meshStandardMaterial color={colors.primary} transparent opacity={opacity} />
            </mesh>
            <Html
              position={[node.x, node.y, node.z + unitSize * 1.4]}
              center
              style={{ pointerEvents: "none", opacity }}
            >
              {/* El verde de `--primary` en oscuro no se lee como texto chico: mismo
                  arreglo que los nombres de nudo del esquema 2D. */}
              <span className="rounded bg-background/80 px-1 text-xs font-semibold text-primary dark:text-green-500">
                {node.name}
              </span>
            </Html>
          </group>
        );
      })}

      {/* Apoyos y fuerzas se apagan con su nudo: son de él (la misma lección
          que en 2D, donde lo encontró la captura). */}
      {supports.map((support) => (
        <SupportGlyph3D
          key={support.nodeId}
          support={support}
          unitSize={unitSize}
          color={colors.mutedForeground}
          opacity={opacityOf("node", support.nodeId)}
        />
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
          opacity={opacityOf("node", force.nodeId)}
        />
      ))}

      {motion.length > 0 && (
        <group>
          {/* La figura desplazada, solo en las barras que tocan un nudo que se mueve. */}
          {elements.map((element) => {
            const from = nodesById.get(element.fromNodeId);
            const to = nodesById.get(element.toNodeId);
            if (!from || !to || !(motionByNode.has(from.id) || motionByNode.has(to.id))) return null;
            return (
              <Line
                key={element.id}
                points={[moved(from), moved(to)]}
                color={MOTION_AMBER}
                lineWidth={2}
                dashed
                dashSize={unitSize * 0.6}
                gapSize={unitSize * 0.4}
              />
            );
          })}
          {motion.map(({ nodeId, vector }) => {
            const node = nodesById.get(nodeId);
            if (!node) return null;
            return <MotionArrow key={nodeId} origin={point(node)} vector={vector} length={motionScale} unitSize={unitSize} />;
          })}
        </group>
      )}

      {/*
        Las zonas sensibles van aparte y al final, como en el esquema 2D: una
        línea de 2.5 px no se puede cazar con el mouse, así que cada barra lleva
        un cilindro invisible más grueso, y cada nudo una esfera más grande que
        la que se ve. Los nudos son más gordos que las barras, así que en un
        encuentro el rayo toca primero el nudo, que es el más chico de los dos.
        Invisibles con opacidad 0 y no con `visible={false}`: un objeto oculto
        no recibe eventos del mouse.
      */}
      {onHighlight && (
        <group>
          {elements.map((element) => {
            const from = nodesById.get(element.fromNodeId);
            const to = nodesById.get(element.toNodeId);
            if (!from || !to) return null;
            const a = point(from);
            const b = point(to);
            const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
            if (length === 0) return null;
            return (
              <mesh
                key={element.id}
                position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]}
                quaternion={quaternionTowards([b[0] - a[0], b[1] - a[1], b[2] - a[2]])}
                onPointerOver={pointTo({ nodeIds: [element.fromNodeId, element.toNodeId], elementIds: [element.id] })}
                onPointerOut={leave}
              >
                <cylinderGeometry args={[unitSize * 0.35, unitSize * 0.35, length, 8]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            );
          })}
          {nodes.map((node) => (
            <mesh
              key={node.id}
              position={point(node)}
              onPointerOver={pointTo({ nodeIds: [node.id], elementIds: [] })}
              onPointerOut={leave}
            >
              <sphereGeometry args={[unitSize * 0.9, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}
    </SceneCanvas>
  );
}

/**
 * Una flecha en cualquier dirección, para el movimiento de un mecanismo. Las
 * de `ForceArrow3D` van siempre sobre un eje; un modo no.
 */
function MotionArrow({
  origin,
  vector,
  length,
  unitSize,
}: {
  origin: Point3;
  vector: Point3;
  length: number;
  unitSize: number;
}) {
  const norm = Math.hypot(...vector);
  if (norm === 0) return null;
  const direction: Point3 = [vector[0] / norm, vector[1] / norm, vector[2] / norm];
  const total = length * norm;
  const headHeight = Math.min(unitSize * 1.2, total * 0.5);
  const shaftLength = total - headHeight;
  const along = (distance: number): Point3 => [
    origin[0] + direction[0] * distance,
    origin[1] + direction[1] * distance,
    origin[2] + direction[2] * distance,
  ];
  const rotation = quaternionTowards(direction);

  return (
    <group>
      <mesh position={along(shaftLength / 2)} quaternion={rotation}>
        <cylinderGeometry args={[unitSize * 0.14, unitSize * 0.14, shaftLength, 10]} />
        <meshStandardMaterial color={MOTION_AMBER} />
      </mesh>
      <mesh position={along(shaftLength + headHeight / 2)} quaternion={rotation}>
        <coneGeometry args={[unitSize * 0.4, headHeight, 12]} />
        <meshStandardMaterial color={MOTION_AMBER} />
      </mesh>
    </group>
  );
}

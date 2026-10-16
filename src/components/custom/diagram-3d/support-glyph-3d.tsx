"use client";

import { DoubleSide } from "three";

import { rotationForAxis } from "./orientation";
import { AXIS_INDEX, type Diagram3DAxis, type Diagram3DSupport, type Point3 } from "./types";

interface SupportGlyph3DProps {
  support: Diagram3DSupport;
  unitSize: number;
  color: number;
  /** Menos de 1 para atenuarlo cuando se señala otra parte del modelo (N3). */
  opacity?: number;
}

const AXES: Diagram3DAxis[] = ["x", "y", "z"];

/**
 * Dos notaciones, por la misma razón que en 2D hay tres: el dibujo tiene que
 * decir **qué** está impedido, no solo que hay un apoyo.
 *
 * - Los 3 DOF restringidos → cono con el vértice en el nudo, apoyado en el
 *   suelo: la articulación espacial completa, el caso habitual.
 * - Restricción parcial (p. ej. solo z, un nudo que apoya sobre un plano) →
 *   un manguito corto sobre cada eje impedido. Dibujar el cono ahí sería
 *   mentir: diría que los tres desplazamientos están tomados.
 */
export function SupportGlyph3D({ support, unitSize, color, opacity = 1 }: SupportGlyph3DProps) {
  const origin: Point3 = [support.x, support.y, support.z];
  const restrained: Record<Diagram3DAxis, boolean> = {
    x: support.restrainedX,
    y: support.restrainedY,
    z: support.restrainedZ,
  };

  const all = restrained.x && restrained.y && restrained.z;

  if (all) {
    const height = unitSize * 2.4;
    return (
      <mesh position={[origin[0], origin[1], origin[2] - height / 2]} rotation={rotationForAxis("z", 1)}>
        <coneGeometry args={[height * 0.5, height, 4]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>
    );
  }

  const sleeveLength = unitSize * 1.8;

  return (
    <group>
      {AXES.filter((axis) => restrained[axis]).map((axis) => (
        <mesh key={axis} position={origin} rotation={rotationForAxis(axis, 1)}>
          <cylinderGeometry args={[unitSize * 0.45, unitSize * 0.45, sleeveLength, 12, 1, true]} />
          <meshStandardMaterial color={color} transparent opacity={0.55 * opacity} side={DoubleSide} />
        </mesh>
      ))}
      {/* Discos en los extremos de cada manguito, para que se lea el eje impedido de perfil. */}
      {AXES.filter((axis) => restrained[axis]).map((axis) => {
        const cap: Point3 = [...origin];
        cap[AXIS_INDEX[axis]] += sleeveLength / 2;
        return (
          <mesh key={`${axis}-cap`} position={cap} rotation={rotationForAxis(axis, 1)}>
            <cylinderGeometry args={[unitSize * 0.55, unitSize * 0.55, unitSize * 0.12, 12]} />
            <meshStandardMaterial color={color} transparent opacity={opacity} />
          </mesh>
        );
      })}
    </group>
  );
}

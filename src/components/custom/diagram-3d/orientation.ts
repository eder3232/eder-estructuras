import { AXIS_INDEX, type Diagram3DAxis, type Point3 } from "./types";

/**
 * Las geometrías de cilindro y cono de three.js nacen apuntando a +Y local. Como
 * todos los glifos de este módulo van sobre un eje coordenado, alcanza con una
 * rotación fija por eje y sentido en vez de armar un quaternion cada vez.
 */
export function rotationForAxis(axis: Diagram3DAxis, sign: 1 | -1): Point3 {
  if (axis === "x") return [0, 0, sign === 1 ? -Math.PI / 2 : Math.PI / 2];
  if (axis === "y") return sign === 1 ? [0, 0, 0] : [Math.PI, 0, 0];
  return [sign === 1 ? Math.PI / 2 : -Math.PI / 2, 0, 0];
}

export function unitVector(axis: Diagram3DAxis, sign: 1 | -1): Point3 {
  const vector: Point3 = [0, 0, 0];
  vector[AXIS_INDEX[axis]] = sign;
  return vector;
}

export function translate(origin: Point3, direction: Point3, distance: number): Point3 {
  return [
    origin[0] + direction[0] * distance,
    origin[1] + direction[1] * distance,
    origin[2] + direction[2] * distance,
  ];
}

export interface Diagram3DNode {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
}

export interface Diagram3DElement {
  id: string;
  name: string;
  fromNodeId: string;
  toNodeId: string;
}

export type Diagram3DAxis = "x" | "y" | "z";

/**
 * Genérico para una fuerza aplicada o una reacción — el color lo decide quien
 * lo consume, no el tipo. En armaduras espaciales los 3 DOF son traslaciones,
 * así que no hace falta el caso "momento" que el módulo 2D resuelve con arcos.
 */
export interface Diagram3DForce {
  nodeId: string;
  x: number;
  y: number;
  z: number;
  axis: Diagram3DAxis;
  value: number;
}

export interface Diagram3DSupport {
  nodeId: string;
  x: number;
  y: number;
  z: number;
  restrainedX: boolean;
  restrainedY: boolean;
  restrainedZ: boolean;
}

/** Vector en coordenadas estructurales, que son también las de la escena (z arriba). */
export type Point3 = [number, number, number];

export const AXIS_INDEX: Record<Diagram3DAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

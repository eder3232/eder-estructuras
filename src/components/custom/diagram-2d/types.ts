export interface DiagramNode {
  id: string;
  name: string;
  x: number;
  z: number;
}

export interface DiagramElement {
  id: string;
  name: string;
  fromNodeId: string;
  toNodeId: string;
}

/**
 * Genérico para una fuerza aplicada o una reacción — el color lo decide quien
 * lo consume, no el tipo. El eje `"r"` es el DOF rotacional: el valor es un
 * momento, y se dibuja como arco en vez de flecha recta (ver `ForceGlyph`).
 */
export interface DiagramForce {
  nodeId: string;
  x: number;
  z: number;
  axis: "x" | "z" | "r";
  value: number;
}

export interface DiagramSupport {
  nodeId: string;
  x: number;
  z: number;
  restrainedX: boolean;
  restrainedZ: boolean;
  /** Solo los sistemas con DOF rotacional (pórticos) lo declaran. */
  restrainedRotation?: boolean;
}

/**
 * Una carga a lo largo de una barra (solo pórticos). El diagrama no sabe de
 * ejes locales ni de proyecciones: recibe la dirección ya resuelta a ejes
 * globales y las posiciones a lo largo de la barra, y dibuja.
 *
 * - `distributed`: `q1` en `a`, `q2` en `b` (en unidades de largo de la barra).
 * - `point`: `q1` en `a`.
 * - `moment`: `q1` en `a`, antihorario positivo; `direction` no se usa.
 */
export interface DiagramMemberLoad {
  id: string;
  elementId: string;
  kind: "distributed" | "point" | "moment";
  /** Unitaria, en ejes globales (x a la derecha, z arriba). El signo de `q` la invierte. */
  direction: { x: number; z: number };
  q1: number;
  q2: number;
  a: number;
  b: number;
}

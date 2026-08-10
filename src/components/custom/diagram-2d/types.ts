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

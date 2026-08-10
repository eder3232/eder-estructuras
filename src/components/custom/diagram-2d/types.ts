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

/** Genérico para una fuerza aplicada o una reacción — el color lo decide quien lo consume, no el tipo. */
export interface DiagramForce {
  nodeId: string;
  x: number;
  z: number;
  axis: "x" | "z";
  value: number;
}

export interface DiagramSupport {
  nodeId: string;
  x: number;
  z: number;
  restrainedX: boolean;
  restrainedZ: boolean;
}

export interface DofState {
  restrained: boolean;
  /** Fuerza aplicada si el DOF es libre. Debe ser 0 si está restringido. */
  force: number;
  /** Desplazamiento prescrito si el DOF está restringido. Debe ser 0 si es libre. */
  displacement: number;
}

export interface Node {
  id: string;
  /** length === dofPerNode del System al que pertenece. */
  dof: DofState[];
}

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
  /**
   * El número que el alumno le puso a cada grado de libertad, si es que se los
   * puso. Es una **sugerencia de orden, no una orden**: ver `DofOrderOptions`
   * en `system.ts`.
   */
  dofNumbers?: number[];
}

import type { GravityCase } from "../store/model";

/** Lo que se elige en las tablas de cargas: el sismo no se carga a mano en una barra. */
export const GRAVITY_CASES: { id: GravityCase; label: string }[] = [
  { id: "CM", label: "CM" },
  { id: "CV", label: "CV" },
];

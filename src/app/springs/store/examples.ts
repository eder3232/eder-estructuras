import type { ModelExample } from "@/components/custom/model-persistence";
import type { ElementRow } from "./elements";
import type { NodeRow } from "./nodes";
import type { PersistedModel } from "./persisted-model";

/**
 * Sistemas de resortes listos para cargar.
 *
 * **Cada uno existe para mostrar algo que los otros no muestran** — el mismo
 * criterio que los ejemplos de `/armaduras-2d`. Los tres juntos son las tres
 * formas de combinar resortes que se ven en el curso, y cada uno se cruza con
 * la clasificación: el primero es isostático y los otros dos hiperestáticos,
 * por razones distintas.
 *
 * El ejemplo inicial (la red de 5 nudos y 4 resortes, que es además la
 * regresión portada del original) no está en la lista: es el estado por
 * defecto, y se vuelve a él con «Volver al ejemplo inicial».
 */
export type Example = ModelExample<PersistedModel>;

const node = (prefix: string, name: string, force = 0, restrained = false, displacement = 0): NodeRow => ({
  id: `${prefix}-${name}`,
  name,
  force,
  displacement,
  restrained,
  dofNumber: 0,
});

const spring = (prefix: string, name: string, from: string, to: string, k: number): ElementRow => ({
  id: `${prefix}-${name}`,
  name,
  fromNodeId: `${prefix}-${from}`,
  toNodeId: `${prefix}-${to}`,
  k,
});

const model = (nodes: NodeRow[], elements: ElementRow[]): PersistedModel => ({
  nodes,
  elements,
  restrainedFirst: false,
  useDofNumbers: false,
});

export const examples: Example[] = [
  {
    id: "series",
    name: "Resortes en serie",
    description:
      "Isostático: los dos resortes llevan la misma fuerza aunque sus k sean distintas, y los desplazamientos se suman.",
    // v1 fijo — e1 (k = 10) — v2 — e2 (k = 5) — v3, con 10 de carga en la punta.
    // La fuerza es 10 en los dos; v2 baja 1 y v3 baja 1 + 2 = 3.
    model: model(
      [node("ser", "v1", 0, true), node("ser", "v2"), node("ser", "v3", 10)],
      [spring("ser", "e1", "v1", "v2", 10), spring("ser", "e2", "v2", "v3", 5)],
    ),
  },
  {
    id: "parallel",
    name: "Resortes en paralelo",
    description:
      "Hiperestático: dos resortes entre los mismos nudos se reparten la carga según su rigidez — el más rígido se lleva más.",
    // Dos resortes de v1 (fijo) a v2, con k = 10 y k = 30 y 8 de carga. Se
    // desplazan lo mismo (0.2) y se reparten 2 y 6: tres veces más rígido,
    // tres veces más carga. En la matriz, los dos suman en las mismas celdas.
    model: model(
      [node("par", "v1", 0, true), node("par", "v2", 8)],
      [spring("par", "e1", "v1", "v2", 10), spring("par", "e2", "v1", "v2", 30)],
    ),
  },
  {
    id: "settlement",
    name: "Apoyo que cede",
    description:
      "Hiperestático sin ninguna carga: el apoyo de un extremo se corre 0.5 y los resortes igual trabajan, porque no lo pueden acompañar sin deformarse.",
    // v1 fijo — e1 — v2 — e2 — v3, con v3 restringido pero corrido 0.5. Sin
    // cargas. Con k iguales, v2 se corre la mitad y los dos resortes llevan
    // 2.5. Es el desplazamiento prescrito, la rama del método que el ejemplo
    // inicial no ejercita.
    model: model(
      [node("set", "v1", 0, true), node("set", "v2"), node("set", "v3", 0, true, 0.5)],
      [spring("set", "e1", "v1", "v2", 10), spring("set", "e2", "v2", "v3", 10)],
    ),
  },
];

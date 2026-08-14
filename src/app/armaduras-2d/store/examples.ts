import type { ElementRow } from "./elements";
import type { NodeRow } from "./nodes";
import type { PersistedModel } from "./persisted-model";

/**
 * Armaduras listas para cargar.
 *
 * **No son "otras armaduras" cualquiera**: cada una existe para mostrar algo
 * del método que las demás no muestran. Un ejemplo que solo cambia las
 * coordenadas no enseña nada que el ejemplo inicial no enseñe ya.
 *
 * El ejemplo inicial —el cuadro arriostrado de 4 nudos y 6 barras, que además
 * es el caso del test de regresión— no está en esta lista: es el estado por
 * defecto de la página, y se vuelve a él con «Volver al ejemplo inicial».
 */
export interface Example {
  id: string;
  name: string;
  /** Qué muestra **este** y no otro. Es lo que se lee en el menú. */
  description: string;
  model: PersistedModel;
}

/** El mismo material en todos los ejemplos: lo que cambia es la estructura. */
const AREA = 10 * 10 ** -4;
const ELASTICITY = 2 * 10 ** 7;

interface NodeInput {
  id: string;
  name: string;
  x: number;
  z: number;
  forceX?: number;
  forceZ?: number;
  restrainedX?: boolean;
  restrainedZ?: boolean;
  displacementX?: number;
  displacementZ?: number;
}

/** Los ids son estables y legibles a propósito: se guardan y se leen a mano al depurar. */
function node({
  id,
  name,
  x,
  z,
  forceX = 0,
  forceZ = 0,
  restrainedX = false,
  restrainedZ = false,
  displacementX = 0,
  displacementZ = 0,
}: NodeInput): NodeRow {
  return {
    id,
    name,
    x,
    z,
    forceX,
    forceZ,
    displacementX,
    displacementZ,
    restrainedX,
    restrainedZ,
    dofNumberX: 0,
    dofNumberZ: 0,
  };
}

function bar(id: string, name: string, fromNodeId: string, toNodeId: string): ElementRow {
  return { id, name, fromNodeId, toNodeId, area: AREA, elasticity: ELASTICITY };
}

/**
 * El caso mínimo que sigue siendo una armadura: tres barras, tres nudos, y las
 * cuentas se pueden hacer a mano para cotejar contra la pantalla.
 *
 * Es **isostático** —`b + r = 3 + 3 = 6 = 2n`—, así que los esfuerzos salen del
 * equilibrio de los nudos y no dependen de la rigidez: cambiar el área o el
 * módulo no cambia ninguna fuerza interna, solo los desplazamientos. Eso es lo
 * que el ejemplo inicial, que es hiperestático, no puede mostrar.
 */
const triangulo: PersistedModel = {
  nodes: [
    node({ id: "tri-v1", name: "v1", x: 0, z: 0, restrainedX: true, restrainedZ: true }),
    node({ id: "tri-v2", name: "v2", x: 4, z: 0, restrainedZ: true }),
    node({ id: "tri-v3", name: "v3", x: 2, z: 3, forceZ: -10 }),
  ],
  elements: [
    bar("tri-e1", "e1", "tri-v1", "tri-v2"),
    bar("tri-e2", "e2", "tri-v1", "tri-v3"),
    bar("tri-e3", "e3", "tri-v2", "tri-v3"),
  ],
  restrainedFirst: false,
  useDofNumbers: false,
};

/**
 * Una cercha de 7 barras con la carga colgada del nudo central del cordón
 * inferior, y los nudos numerados como se los suele numerar: primero el cordón
 * superior y después los apoyos.
 *
 * **La carga va abajo y no arriba por una razón de dibujo**, que apareció en la
 * captura: con los dos nudos superiores cargados, la etiqueta del valor y el
 * nombre de la diagonal que sale de ese mismo nudo caen en el mismo lugar y se
 * pisan. Las etiquetas de nudo y de barra no se conocen entre sí —el halo las
 * hace legibles, no las separa—, así que la salida barata es no ponerlas juntas.
 *
 * Por eso está: los dos nudos restringidos caen en el **medio** de la tabla, así
 * que el interruptor «los grados de libertad restringidos van arriba» reordena
 * la matriz global a la vista. Con el ejemplo inicial no se nota nada, porque
 * ahí los apoyos ya son las dos primeras filas.
 */
const cercha: PersistedModel = {
  nodes: [
    node({ id: "cer-v1", name: "v1", x: 2, z: 3 }),
    node({ id: "cer-v2", name: "v2", x: 6, z: 3 }),
    node({ id: "cer-v3", name: "v3", x: 0, z: 0, restrainedX: true, restrainedZ: true }),
    node({ id: "cer-v4", name: "v4", x: 8, z: 0, restrainedZ: true }),
    node({ id: "cer-v5", name: "v5", x: 4, z: 0, forceZ: -16 }),
  ],
  elements: [
    bar("cer-e1", "e1", "cer-v3", "cer-v5"),
    bar("cer-e2", "e2", "cer-v5", "cer-v4"),
    bar("cer-e3", "e3", "cer-v1", "cer-v2"),
    bar("cer-e4", "e4", "cer-v3", "cer-v1"),
    bar("cer-e5", "e5", "cer-v1", "cer-v5"),
    bar("cer-e6", "e6", "cer-v5", "cer-v2"),
    bar("cer-e7", "e7", "cer-v2", "cer-v4"),
  ],
  restrainedFirst: false,
  useDofNumbers: false,
};

/**
 * Una armadura sobre **tres apoyos** donde el del medio baja 5 mm, y **sin
 * ninguna carga aplicada**.
 *
 * Es el único ejemplo que usa el desplazamiento prescrito —la rama `Ur ≠ 0` del
 * método, que el motor resuelve desde el Tren 1 y que **ninguna otra pantalla
 * ejercita**—, y la lección se lee sola: no hay una sola fuerza cargada y la
 * estructura igual queda tensionada. Pasa porque es **hiperestática**
 * (`b + r = 7 + 4 = 11` contra `2n = 10`): las barras se estorban entre sí.
 *
 * **La geometría no es la primera que se probó, y el porqué importa.** El
 * primer intento fue el cuadro arriostrado del ejemplo inicial con el apoyo
 * derecho descendido, y dio **cero en las seis barras**: ese descenso resulta
 * compatible con un campo de desplazamientos que no alarga ninguna barra, así
 * que la estructura acompaña sin tensionarse. O sea que *hiperestática +
 * asentamiento* **no** implica esfuerzos — hace falta que el descenso sea
 * incompatible con todo movimiento sin deformación, y eso es lo que consigue el
 * apoyo del medio de un tramo continuo. Es el caso clásico, y ahora también el
 * único que este repo tiene probado.
 */
const asentamiento: PersistedModel = {
  nodes: [
    node({ id: "ase-v1", name: "v1", x: 0, z: 0, restrainedX: true, restrainedZ: true }),
    node({ id: "ase-v2", name: "v2", x: 3, z: 0, restrainedZ: true, displacementZ: -0.005 }),
    node({ id: "ase-v3", name: "v3", x: 6, z: 0, restrainedZ: true }),
    node({ id: "ase-v4", name: "v4", x: 1.5, z: 2 }),
    node({ id: "ase-v5", name: "v5", x: 4.5, z: 2 }),
  ],
  elements: [
    bar("ase-e1", "e1", "ase-v1", "ase-v2"),
    bar("ase-e2", "e2", "ase-v2", "ase-v3"),
    bar("ase-e3", "e3", "ase-v4", "ase-v5"),
    bar("ase-e4", "e4", "ase-v1", "ase-v4"),
    bar("ase-e5", "e5", "ase-v4", "ase-v2"),
    bar("ase-e6", "e6", "ase-v2", "ase-v5"),
    bar("ase-e7", "e7", "ase-v5", "ase-v3"),
  ],
  restrainedFirst: false,
  useDofNumbers: false,
};

export const examples: Example[] = [
  {
    id: "triangulo",
    name: "Triángulo isostático",
    description: "3 barras. Los esfuerzos salen del equilibrio y no dependen del área ni del material.",
    model: triangulo,
  },
  {
    id: "cercha",
    name: "Cercha con los apoyos en el medio",
    description: "7 barras. Acá se ve qué hace el interruptor de orden de los grados de libertad.",
    model: cercha,
  },
  {
    id: "asentamiento",
    name: "Apoyo del medio que cede 5 mm",
    description: "Sin ninguna carga aplicada, y la estructura igual se tensiona: es hiperestática.",
    model: asentamiento,
  },
];

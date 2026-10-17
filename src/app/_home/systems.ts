import type { StaticImageData } from "next/image";

import { systemLinks, theoryLinks } from "@/lib/site-config";

import armaduras2d from "./images/armaduras-2d.webp";
import armaduras3d from "./images/armaduras-3d.webp";
import estabilidad from "./images/estabilidad.webp";
import frame2d from "./images/frame2d.webp";
import frame2dSeismic from "./images/frame2d-seismic.webp";
import springs from "./images/springs.webp";

/**
 * Lo que la home cuenta de cada página. Va aparte de `site-config.ts` porque
 * solo lo usa la home; el rótulo y la ruta sí salen de ahí, para que la barra y
 * las tarjetas no puedan decir cosas distintas.
 *
 * Las imágenes son generadas con IA (Gemini) a propósito para esta página: son
 * decorativas y no ilustran ningún modelo del programa.
 */
type Detail = {
  image: StaticImageData;
  /** Qué muestra la foto, para el `alt`. */
  alt: string;
  dof: string;
  summary: string;
  tags: readonly string[];
};

type Href = (typeof systemLinks)[number]["href"];

const details: Record<Href, Detail> = {
  "/springs": {
    image: springs,
    alt: "Resortes helicoidales de acero en fila sobre una superficie oscura",
    dof: "1 gdl por nudo",
    summary:
      "El caso más simple del método: sin geometría ni transformación. El ensamblaje se ve desnudo, sin nada que lo tape.",
    tags: ["Ensamblaje", "Asentamientos"],
  },
  "/armaduras-2d": {
    image: armaduras2d,
    alt: "Puente ferroviario de acero con armadura Warren sobre un río con neblina",
    dof: "2 gdl por nudo",
    summary:
      "El sistema de referencia: todo se probó acá primero. Barras articuladas, cosenos directores y los mecanismos, dibujados.",
    tags: ["Transformación", "Mecanismos"],
  },
  "/armaduras-3d": {
    image: armaduras3d,
    alt: "Cubierta de malla espacial de acero vista desde abajo",
    dof: "3 gdl por nudo",
    summary: "Armaduras espaciales en una escena 3D que se gira con el mouse, con el mismo paso a paso que las planas.",
    tags: ["Escena 3D", "Cosenos directores"],
  },
  "/frame2d": {
    image: frame2d,
    alt: "Pórtico de concreto armado en construcción, con columnas y vigas a la vista",
    dof: "3 gdl por nudo, con giro",
    summary:
      "Pórticos con cargas en las barras: el FEM calculado, los diagramas N, V y M exactos y la deformada real entre nudos.",
    tags: ["FEM", "Diagramas N/V/M", "Deformada"],
  },
  "/frame2d-seismic": {
    image: frame2dSeismic,
    alt: "Edificio de concreto armado de varios pisos frente al mar",
    dof: "3 gdl + 1 lateral por piso",
    summary:
      "Casos de carga, el cortante basal de la E.030, diafragma rígido, rigidez lateral por condensación, derivas y la envolvente de la E.060.",
    tags: ["E.030 2026", "E.060", "Derivas"],
  },
};

export const homeSystems = systemLinks.map((link) => ({ ...link, ...details[link.href] }));

export const homeTheory = {
  ...theoryLinks[0],
  image: estabilidad,
  alt: "Dos modelos de palitos articulados: un cuadrado que se tumbó en paralelogramo y un triángulo que se mantiene",
  summary:
    "Por qué K es singular sin apoyos, qué es un mecanismo y qué hace un programa de verdad cuando se encuentra con uno.",
};

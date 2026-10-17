"use client";

import { createContext, useContext } from "react";
import type { Atom } from "jotai";

import { atomClassification, type Frame2DClassification } from "./store/classification";
import { atomElements, type ElementRow } from "./store/elements";
import { atomLoads, type LoadRow } from "./store/loads";
import { atomNodes, type NodeRow } from "./store/nodes";
import {
  atomMemberDiagrams,
  atomMemberLoads,
  atomMemberShapes,
  atomResults,
  type Frame2DMemberLoads,
  type Frame2DResults,
  type MemberDiagramResult,
  type MemberShape,
} from "./store/results";

/**
 * **Qué pórtico muestran los componentes de resultados.** En `/frame2d` es
 * uno solo, el del store, y este contexto ni se nota: su valor por defecto son
 * los átomos de siempre.
 *
 * Existe por `frame2d-seismic`, que resuelve el **mismo** pórtico una vez por
 * caso de carga (CM, CV, CS) y muestra el procedimiento de cada uno con estos
 * mismos componentes: envuelve cada vista en un `Frame2DViewProvider` con los
 * átomos de ese caso. Así el procedimiento no se copia (el bug de duplicación
 * del original, ver `docs/frame2d-seismic-v1.md`).
 *
 * Las tablas de entrada (nudos, barras, cargas) **no** pasan por acá: editan
 * el modelo, y la página sísmica las aísla con un `Provider` de Jotai.
 */
export interface Frame2DView {
  atomNodes: Atom<NodeRow[]>;
  atomElements: Atom<ElementRow[]>;
  atomLoads: Atom<LoadRow[]>;
  atomResults: Atom<Frame2DResults>;
  atomMemberLoads: Atom<Frame2DMemberLoads>;
  atomMemberDiagrams: Atom<Map<string, MemberDiagramResult>>;
  atomMemberShapes: Atom<Map<string, MemberShape>>;
  atomClassification: Atom<Frame2DClassification>;
}

export const frame2DModelView: Frame2DView = {
  atomNodes,
  atomElements,
  atomLoads,
  atomResults,
  atomMemberLoads,
  atomMemberDiagrams,
  atomMemberShapes,
  atomClassification,
};

const Frame2DViewContext = createContext<Frame2DView>(frame2DModelView);

export const Frame2DViewProvider = Frame2DViewContext.Provider;

export function useFrame2DView(): Frame2DView {
  return useContext(Frame2DViewContext);
}

"use client";

import { TrussElementTable, type TrussElementStore } from "@/components/custom/truss-element-table";
import { atomNodes } from "../store/nodes";
import {
  atomAddElement,
  atomElements,
  atomRemoveElement,
  atomSetAllElementsNumber,
  atomUpdateElementField,
} from "../store/elements";

const store: TrussElementStore = {
  elements: atomElements,
  nodes: atomNodes,
  addElement: atomAddElement,
  removeElement: atomRemoveElement,
  setAllElementsNumber: atomSetAllElementsNumber,
  updateElementField: atomUpdateElementField,
};

/** La tabla compartida de barras, con el store de `/armaduras-2d`. */
export function ElementTable() {
  return <TrussElementTable store={store} />;
}

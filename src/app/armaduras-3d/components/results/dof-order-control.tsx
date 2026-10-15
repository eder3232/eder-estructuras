"use client";

import { useAtom, useSetAtom } from "jotai";

import { DofOrderControl as GenericDofOrderControl } from "@/components/custom/dof-order-control";
import { atomRestrainedFirst, atomToggleRestrainedFirst, atomUseDofNumbers } from "../../store/dof-order";

/** El control genérico, con el estado de `/armaduras-3d`. */
export function DofOrderControl() {
  const [restrainedFirst] = useAtom(atomRestrainedFirst);
  const [useDofNumbers] = useAtom(atomUseDofNumbers);
  const toggle = useSetAtom(atomToggleRestrainedFirst);

  return <GenericDofOrderControl restrainedFirst={restrainedFirst} useDofNumbers={useDofNumbers} onToggle={toggle} />;
}

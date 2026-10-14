"use client";

import { EquilibriumSection as GenericEquilibriumSection } from "@/components/custom/equilibrium-section";
import { Math } from "@/components/custom/math";
import type { EquilibriumCheck } from "@/lib/engine";
import type { NodeRow } from "../../store/nodes";

export { EquilibriumBadge } from "@/components/custom/equilibrium-section";

/**
 * N5 en una armadura plana: dos ecuaciones por nudo, y cada barra tira sobre
 * su propio eje. La tabla y el texto común viven en
 * `custom/equilibrium-section.tsx`; acá va solo lo que es de armaduras.
 */
export function EquilibriumSection({
  equilibrium,
  nodesById,
}: {
  equilibrium: EquilibriumCheck;
  nodesById: Map<string, NodeRow>;
}) {
  return (
    <GenericEquilibriumSection
      equilibrium={equilibrium}
      nodeName={(id) => nodesById.get(id)?.name ?? id}
      axes={["X", "Z"]}
      vocabulary={{ one: "barra", many: "barras", the: "las" }}
      equation="\sum F_x = 0 \qquad \sum F_z = 0 \qquad \text{en cada nudo}"
      howElementsPull={
        <>
          El aporte de cada barra es su fuerza axial <Math tex="N" /> proyectada sobre los dos ejes (
          <Math tex="N\,C_x" /> y <Math tex="N\,C_z" />, con la sección 4), y apunta{" "}
          <span className="font-medium text-foreground">hacia la otra punta</span> de la barra: una barra
          traccionada tira de sus dos nudos hacia adentro.
        </>
      }
    />
  );
}

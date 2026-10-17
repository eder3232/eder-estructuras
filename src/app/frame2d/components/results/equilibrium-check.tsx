"use client";

import { EquilibriumSection as GenericEquilibriumSection } from "@/components/custom/equilibrium-section";
import { Math } from "@/components/custom/math";
import type { EquilibriumCheck } from "@/lib/engine";
import type { NodeRow } from "../../store/nodes";

export { EquilibriumBadge } from "@/components/custom/equilibrium-section";

/**
 * N5 en un pórtico: tres ecuaciones por nudo, la tercera de momentos. Lo que
 * cada barra le hace al nudo es **su fuerza de extremo verdadera** —la de la
 * tabla de fuerzas internas, con el FEM adentro—, así que una carga a lo largo
 * de una barra llega al nudo por esa barra y no aparece como carga del nudo.
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
      axes={["X", "Z", "M"]}
      vocabulary={{ one: "barra", many: "barras", the: "las" }}
      equation="\sum F_x = 0 \qquad \sum F_z = 0 \qquad \sum M = 0 \qquad \text{en cada nudo}"
      howElementsPull={
        <>
          El aporte de cada barra es el opuesto de su fuerza de extremo en ejes globales —lo que la barra le hace al
          nudo—, con el momento incluido: <Math tex="-(k\,u + T^{T}\,\mathrm{FEM})" />. Una carga a lo largo de una
          barra llega al nudo <span className="font-medium text-foreground">a través de esa barra</span>, por eso no
          aparece en la columna de cargas del nudo. Para toda la estructura, la suma de momentos se toma respecto del
          origen, con brazos de palanca.
        </>
      }
      structureTotal={{
        note: "ΣFx, ΣFz y ΣM respecto del origen, con todas las cargas",
        explanation: (
          <>
            <span className="font-medium text-foreground">La última fila no es la suma de las columnas</span>, como en
            una armadura. Ahí cada barra tira de sus dos nudos con fuerzas iguales y opuestas y se cancelan de a pares;
            en un pórtico no: si la barra tiene carga, las fuerzas en sus dos extremos ya no son iguales y opuestas
            —la diferencia es la carga—, y los momentos de sus extremos no se cancelan entre sí: se equilibran con el
            corte por el largo de la barra. Por eso el control
            de toda la estructura se hace aparte: las cargas de los nudos, las de las barras y las reacciones, con la
            suma de momentos respecto del origen (<Math tex="M + x\,F_z - z\,F_x" /> por nudo). Sumar los momentos
            de los nudos sin brazos de palanca no es una ecuación de equilibrio.
          </>
        ),
      }}
    />
  );
}

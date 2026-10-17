"use client";

import { useAtomValue } from "jotai";

import { ClassificationView, plural } from "@/components/custom/classification-view";
import { atomClassification } from "../store/classification";

/**
 * La clasificación de un pórtico plano: `g = 3b + r − 3n`. Va entre el esquema
 * y los resultados, como en los otros sistemas: se mira, se cuenta, y recién
 * después se calcula.
 */
export function Classification() {
  const classification = useAtomValue(atomClassification);

  if (classification.status === "empty") {
    return (
      <p className="text-sm text-muted-foreground">
        Aparece en cuanto el modelo tenga nudos y barras: se cuenta antes de calcular.
      </p>
    );
  }

  const { bars, reactions, nodes, count, verdict } = classification;

  return (
    <ClassificationView
      formula={`g = 3b + r - 3n = 3 \\cdot ${bars} + ${reactions} - 3 \\cdot ${nodes} = ${count.degree}`}
      legend={
        <>
          <span className="font-medium text-foreground">3b</span>: {plural(bars, "barra", "barras")}, con tres
          esfuerzos desconocidos cada una (N, V y M en un extremo; los del otro salen del equilibrio de la barra).{" "}
          <span className="font-medium text-foreground">r</span>:{" "}
          {plural(reactions, "grado restringido", "grados restringidos")}, una reacción desconocida cada uno —un
          empotramiento aporta tres—. <span className="font-medium text-foreground">3n</span>: tres ecuaciones de
          equilibrio (ΣFx, ΣFz, ΣM) por cada uno de los {plural(nodes, "nudo", "nudos")}. En total,{" "}
          {plural(count.unknowns, "incógnita", "incógnitas")} contra {plural(count.equations, "ecuación", "ecuaciones")}.
        </>
      }
      verdict={verdict}
      degree={count.degree}
      whenDeterminate="Los esfuerzos y las reacciones salen del equilibrio solo: no dependen del material ni de la sección. Los desplazamientos sí."
      whenIndeterminate="Por eso acá los esfuerzos dependen de la rigidez relativa de cada barra (EI/L a flexión, EA/L axial): cambiar una sección cambia cómo se reparten los momentos. Un pórtico de un vano con dos empotramientos ya es hiperestático de grado 3."
      arrangementPitfalls="apoyos que no frenan los tres movimientos de cuerpo rígido del plano (por ejemplo, todos los apoyos dejan libre el desplazamiento horizontal, o las tres reacciones de los apoyos pasan por un mismo punto), o restricciones que sobran en una parte y faltan en otra."
    />
  );
}

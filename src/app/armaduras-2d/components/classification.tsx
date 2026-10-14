"use client";

import { useAtomValue } from "jotai";

import { ClassificationView, plural } from "@/components/custom/classification-view";
import { atomClassification } from "../store/classification";

/**
 * La clasificación de una armadura plana: `g = b + r − 2n`. Va entre el esquema
 * y los resultados porque es eso en el pizarrón — se mira el dibujo, se cuenta,
 * y recién después se calcula. El veredicto y el texto común viven en
 * `custom/classification-view.tsx`; acá va lo que es de armaduras.
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
      formula={`g = b + r - 2n = ${bars} + ${reactions} - 2 \\cdot ${nodes} = ${count.degree}`}
      legend={
        <>
          <span className="font-medium text-foreground">b</span>: {plural(bars, "barra", "barras")}, una fuerza axial
          desconocida cada una. <span className="font-medium text-foreground">r</span>:{" "}
          {plural(reactions, "grado restringido", "grados restringidos")}, una reacción desconocida cada uno.{" "}
          <span className="font-medium text-foreground">2n</span>: dos ecuaciones de equilibrio por cada uno de los{" "}
          {plural(nodes, "nudo", "nudos")}. En total, {plural(count.unknowns, "incógnita", "incógnitas")} contra{" "}
          {plural(count.equations, "ecuación", "ecuaciones")}.
        </>
      }
      verdict={verdict}
      degree={count.degree}
      whenDeterminate="Los esfuerzos en las barras y las reacciones salen del equilibrio solo: no dependen del área ni del material. Los desplazamientos sí."
      whenIndeterminate="Por eso acá los esfuerzos dependen de la rigidez relativa EA/L de cada barra."
      arrangementPitfalls="barras o apoyos que sobran en una parte y faltan en otra (un apoyo de más no reemplaza a una diagonal que falta), o apoyos que no frenan los tres movimientos de cuerpo rígido (todos paralelos, o todos apuntando a un mismo punto)."
    />
  );
}

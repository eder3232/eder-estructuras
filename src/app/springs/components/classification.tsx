"use client";

import { useAtomValue } from "jotai";

import { ClassificationView, plural } from "@/components/custom/classification-view";
import { atomClassification } from "../store/classification";

/**
 * La clasificación de un sistema de resortes: `g = b + r − n`. Es la misma
 * sección que `/armaduras-2d`, con una ecuación por nudo en vez de dos.
 */
export function Classification() {
  const classification = useAtomValue(atomClassification);

  if (classification.status === "empty") {
    return (
      <p className="text-sm text-muted-foreground">
        Aparece en cuanto el modelo tenga nudos y resortes: se cuenta antes de calcular.
      </p>
    );
  }

  const { springs, reactions, nodes, count, verdict } = classification;

  return (
    <ClassificationView
      formula={`g = b + r - n = ${springs} + ${reactions} - ${nodes} = ${count.degree}`}
      legend={
        <>
          <span className="font-medium text-foreground">b</span>: {plural(springs, "resorte", "resortes")}, una fuerza
          desconocida cada uno. <span className="font-medium text-foreground">r</span>:{" "}
          {plural(reactions, "nudo restringido", "nudos restringidos")}, una reacción desconocida cada uno.{" "}
          <span className="font-medium text-foreground">n</span>: una ecuación de equilibrio por cada uno de los{" "}
          {plural(nodes, "nudo", "nudos")}, porque cada nudo se mueve en una sola dirección. En total,{" "}
          {plural(count.unknowns, "incógnita", "incógnitas")} contra {plural(count.equations, "ecuación", "ecuaciones")}.
        </>
      }
      verdict={verdict}
      degree={count.degree}
      whenDeterminate="Las fuerzas en los resortes y las reacciones salen del equilibrio solo: no dependen de las k. Los desplazamientos sí."
      whenIndeterminate="Por eso acá las fuerzas se reparten según la rigidez relativa k de cada resorte: el más rígido se lleva más."
      arrangementPitfalls="resortes o apoyos que sobran en una parte y faltan en otra (un apoyo de más en un extremo no sujeta a un grupo de nudos que quedó desconectado del resto)."
    />
  );
}

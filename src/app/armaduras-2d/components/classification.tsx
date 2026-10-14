"use client";

import Link from "next/link";
import { useAtomValue } from "jotai";
import { CircleCheck, CircleSlash, Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui-custom/alert";
import { Math } from "@/components/custom/math";
import { atomClassification, type Verdict } from "../store/classification";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Lo que da la cuenta, sin afirmar nada sobre la estabilidad. */
const byCount = (degree: number) => (degree === 0 ? "isostática" : `hiperestática de grado ${degree}`);

/**
 * La clasificación de la estructura: el primer paso del pizarrón, antes de
 * armar `K`. Va entre el esquema y los resultados porque es eso — se mira el
 * dibujo, se cuenta, y recién después se calcula.
 *
 * El conteo solo no alcanza, y la sección lo dice: el veredicto cruza la
 * cuenta con lo que encontró el motor (ver `store/classification.ts`). El caso
 * que más enseña es el que el conteo no puede ver — da `g ≥ 0` y la matriz
 * encuentra un mecanismo igual.
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
  const { degree } = count;

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <Math tex={`g = b + r - 2n = ${bars} + ${reactions} - 2 \\cdot ${nodes} = ${degree}`} className="text-lg" />
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">b</span>: {plural(bars, "barra", "barras")}, una fuerza axial
        desconocida cada una. <span className="font-medium text-foreground">r</span>:{" "}
        {plural(reactions, "grado restringido", "grados restringidos")}, una reacción desconocida cada uno.{" "}
        <span className="font-medium text-foreground">2n</span>: dos ecuaciones de equilibrio por cada uno de los{" "}
        {plural(nodes, "nudo", "nudos")}. En total, {plural(count.unknowns, "incógnita", "incógnitas")} contra{" "}
        {plural(count.equations, "ecuación", "ecuaciones")}.
      </p>
      <VerdictAlert verdict={verdict} degree={degree} />
    </div>
  );
}

function VerdictAlert({ verdict, degree }: { verdict: Verdict; degree: number }) {
  switch (verdict) {
    case "determinate":
      return (
        <Alert>
          <CircleCheck />
          <AlertTitle>Isostática</AlertTitle>
          <AlertDescription>
            Hay tantas fuerzas desconocidas como ecuaciones, y la matriz confirma que es estable. Los esfuerzos en las
            barras y las reacciones salen del equilibrio solo: no dependen del área ni del material. Los
            desplazamientos sí.
          </AlertDescription>
        </Alert>
      );
    case "indeterminate":
      return (
        <Alert>
          <CircleCheck />
          <AlertTitle>Hiperestática de grado {degree}</AlertTitle>
          <AlertDescription>
            Hay {plural(degree, "incógnita", "incógnitas")} de más, y la matriz confirma que es estable. El equilibrio
            solo no alcanza para hallar los esfuerzos: lo que falta lo aporta la compatibilidad de deformaciones —que
            las barras sigan unidas en los nudos—, que es justamente lo que hace la matriz de rigidez. Por eso acá los
            esfuerzos dependen de la rigidez relativa EA/L de cada barra.
          </AlertDescription>
        </Alert>
      );
    case "unstable-by-count":
      return (
        <Alert variant="destructive">
          <CircleSlash />
          <AlertTitle>Inestable: {plural(-degree, "incógnita", "incógnitas")} de menos</AlertTitle>
          <AlertDescription>
            Hay más ecuaciones de equilibrio que fuerzas para cumplirlas, así que algún movimiento no tiene nada que se
            le oponga. El conteo alcanza para afirmarlo sin mirar la geometría. Cuál es ese movimiento lo dice el
            diagnóstico de Resultados.
          </AlertDescription>
        </Alert>
      );
    case "unstable-by-arrangement":
      return (
        <Alert variant="destructive">
          <CircleSlash />
          <AlertTitle>Inestable por su disposición, aunque el conteo dé {byCount(degree)}</AlertTitle>
          <AlertDescription>
            <p>
              El conteo es condición <span className="font-medium">necesaria, no suficiente</span>: dice que hay
              barras y apoyos en número suficiente, no que estén bien puestos. Acá la matriz encontró un movimiento que
              nada impide —en Resultados está cuál—. Es lo que el conteo no puede ver: barras o apoyos que sobran en
              una parte y faltan en otra (un apoyo de más no reemplaza a una diagonal que falta), o apoyos que no
              frenan los tres movimientos de cuerpo rígido (todos paralelos, o todos apuntando a un mismo punto).
            </p>
            <p>
              Más sobre esto en{" "}
              <Link href="/estabilidad" className="underline underline-offset-3 hover:text-foreground">
                estabilidad y unicidad de la solución
              </Link>
              .
            </p>
          </AlertDescription>
        </Alert>
      );
    case "unconfirmed":
      return (
        <Alert variant="warning">
          <Info />
          <AlertTitle>El conteo da {byCount(degree)}, falta confirmarlo</AlertTitle>
          <AlertDescription>
            El modelo tiene errores de datos y todavía no se pudo mirar la matriz. Hasta entonces es solo la cuenta, y
            la cuenta es condición necesaria, no suficiente.
          </AlertDescription>
        </Alert>
      );
  }
}

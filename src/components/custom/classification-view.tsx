"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CircleCheck, CircleSlash, Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui-custom/alert";
import { Math } from "@/components/custom/math";
import type { Verdict } from "@/lib/classification-verdict";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Lo que da la cuenta, sin afirmar nada sobre la estabilidad. */
const byCount = (degree: number) => (degree === 0 ? "isostática" : `hiperestática de grado ${degree}`);

/**
 * La clasificación de una estructura: el primer paso del pizarrón, antes de
 * armar `K`. Nació en `/armaduras-2d` y se volvió genérica al llevarla a
 * `/springs`: la cuenta y el veredicto son los mismos, y lo que cambia —la
 * fórmula, qué es cada término, de qué dependen los esfuerzos— entra por props.
 *
 * El conteo solo no alcanza, y la sección lo dice: el veredicto cruza la
 * cuenta con lo que encontró el motor (ver `lib/classification-verdict.ts`).
 */
export function ClassificationView({
  formula,
  legend,
  verdict,
  degree,
  whenDeterminate,
  whenIndeterminate,
  arrangementPitfalls,
}: {
  /** La cuenta con los números del modelo, en TeX. */
  formula: string;
  /** Qué es cada término, en el idioma del sistema. */
  legend: ReactNode;
  verdict: Verdict;
  degree: number;
  /** De qué **no** dependen los esfuerzos cuando es isostática. */
  whenDeterminate: ReactNode;
  /** De qué dependen los esfuerzos cuando es hiperestática. */
  whenIndeterminate: ReactNode;
  /** Ejemplos de lo que el conteo no ve, en el idioma del sistema. */
  arrangementPitfalls: ReactNode;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <Math tex={formula} className="text-lg" />
      <p className="text-sm text-muted-foreground">{legend}</p>
      <VerdictAlert
        verdict={verdict}
        degree={degree}
        whenDeterminate={whenDeterminate}
        whenIndeterminate={whenIndeterminate}
        arrangementPitfalls={arrangementPitfalls}
      />
    </div>
  );
}

function VerdictAlert({
  verdict,
  degree,
  whenDeterminate,
  whenIndeterminate,
  arrangementPitfalls,
}: {
  verdict: Verdict;
  degree: number;
  whenDeterminate: ReactNode;
  whenIndeterminate: ReactNode;
  arrangementPitfalls: ReactNode;
}) {
  switch (verdict) {
    case "determinate":
      return (
        <Alert>
          <CircleCheck />
          <AlertTitle>Isostática</AlertTitle>
          <AlertDescription>
            Hay tantas fuerzas desconocidas como ecuaciones, y la matriz confirma que es estable. {whenDeterminate}
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
            solo no alcanza para hallar los esfuerzos: lo que falta lo aporta la compatibilidad de deformaciones, que
            es justamente lo que hace la matriz de rigidez. {whenIndeterminate}
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
              elementos y apoyos en número suficiente, no que estén bien puestos. Acá la matriz encontró un movimiento
              que nada impide —en Resultados está cuál—. Es lo que el conteo no puede ver: {arrangementPitfalls}
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

export { plural };

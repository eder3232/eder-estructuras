import type { ReactNode } from "react";

import type { AssemblyResult } from "@/lib/engine";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui-custom/accordion";
import { DecimalsScope, ScopeDecimalsStepper } from "./decimals-scope";
import { MatrixTable } from "./matrix-table";

type Step = AssemblyResult["steps"][number];

/**
 * Desde cuántos grados de libertad los pasos van cerrados (D14). Con 12 la
 * matriz de cada paso todavía se lee en la página (~13 columnas entran a 1400
 * px); pasado eso cada paso es un muro de números, y la torre de 10 nudos en 3D
 * tendría ~25 muros de 30×30 seguidos.
 */
export const COLLAPSE_ABOVE_DOFS = 12;

/** Las celdas que cambiaron respecto del paso anterior. */
export function diffPositions(prev: number[][] | null, curr: number[][]): [number, number][] {
  const positions: [number, number][] = [];
  curr.forEach((row, i) =>
    row.forEach((value, j) => {
      const prevValue = prev ? prev[i][j] : 0;
      if (value !== prevValue) positions.push([i, j]);
    }),
  );
  return positions;
}

/**
 * El ensamblaje paso a paso: la matriz global después de sumar cada elemento,
 * con las celdas que cambiaron resaltadas.
 *
 * Genérico desde el paso 3 de `/armaduras-3d` (2026-10-16): estaba copiado tres
 * veces, y las copias ya se habían separado — la de `/springs` y la de 3D no
 * tenían scroll propio, así que una matriz ancha **se recortaba** contra el
 * `overflow-hidden` del acordeón. Lo propio de cada sistema es solo cómo se
 * rotula un grado de libertad y cómo se cuenta un paso.
 *
 * **Pasado `COLLAPSE_ABOVE_DOFS`, los pasos van cerrados y se abren de a uno.**
 * El ensamblaje se entiende mirando *qué cambia* de un paso al siguiente, y con
 * veinte matrices grandes abiertas una debajo de la otra eso se pierde en el
 * scroll: abriendo una, se ve una.
 */
export function AssemblySteps({
  steps,
  labels,
  describe,
}: {
  steps: Step[];
  /** El rótulo de cada grado de libertad, en el orden de la matriz. */
  labels: string[];
  /** Qué hace el paso, después de "Paso N:" (qué elemento, qué nudos conecta). */
  describe: (step: Step) => ReactNode;
}) {
  const collapsed = labels.length > COLLAPSE_ABOVE_DOFS;

  const matrixOf = (i: number) => {
    const step = steps[i];
    const previous = i > 0 ? steps[i - 1].globalStiffnessAfter : null;
    return (
      // La matriz global crece con la cantidad de nudos, así que necesita su
      // propio contenedor de scroll: sin él no se desborda, se **recorta**,
      // porque `AccordionContent` lleva `overflow-hidden`. Y como es de las que
      // crecen, las etiquetas van fijas: scrollear una de 30×30 sin ellas es
      // leer números sin saber de qué grado de libertad son.
      <div className="max-w-full overflow-x-auto">
        <MatrixTable
          matrix={step.globalStiffnessAfter}
          labels={labels}
          highlight={diffPositions(previous, step.globalStiffnessAfter)}
          stickyLabels
        />
      </div>
    );
  };

  const title = (step: Step, i: number) => (
    <>
      <span className="font-medium">Paso {i + 1}:</span> {describe(step)}
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        La matriz global se arma sumando la contribución de cada elemento, uno a la vez. Las celdas resaltadas son las
        que cambiaron en ese paso.
        {collapsed && (
          <>
            {" "}
            Con {labels.length} grados de libertad cada paso es una matriz de {labels.length}×{labels.length}, así que
            van cerrados: abrí el que quieras ver, y se ve de a uno.
          </>
        )}
      </p>

      {collapsed ? (
        <Accordion type="single" collapsible className="border-t">
          {steps.map((step, i) => (
            <AccordionItem key={step.elementId} value={step.elementId}>
              <AccordionTrigger className="py-2.5 text-sm font-normal">
                <span>{title(step, i)}</span>
              </AccordionTrigger>
              <AccordionContent>
                <DecimalsScope id={step.elementId}>
                  <div className="flex flex-col gap-2">
                    <ScopeDecimalsStepper className="self-start" />
                    {matrixOf(i)}
                  </div>
                </DecimalsScope>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        steps.map((step, i) => (
          <DecimalsScope key={step.elementId} id={step.elementId}>
            <div className="flex flex-col gap-2">
              {/* Sin `justify-between`: el stepper va pegado a su etiqueta, no
                  en el borde del bloque (el párrafo tiene ancho máximo y
                  quedaban a 500 px). `mb-0`: AccordionContent le mete `mb-4` a
                  todo `p` que no sea `:last-child`, y acá el stepper viene
                  después. */}
              <div className="flex items-start gap-3">
                <p className="mb-0 text-sm">{title(step, i)}</p>
                <ScopeDecimalsStepper className="shrink-0" />
              </div>
              {matrixOf(i)}
            </div>
          </DecimalsScope>
        ))
      )}
    </div>
  );
}

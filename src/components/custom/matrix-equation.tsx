"use client";

import type { ReactNode } from "react";
import { Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Math } from "./math";

/** Lo que necesita la vista en pantalla completa de una ecuación. */
export interface EquationExpand {
  title: string;
  description?: ReactNode;
}

/**
 * Una ecuación matricial: operandos en fila con operadores en el medio, como se
 * escribe en el pizarrón.
 *
 * **Por qué importa que exista como componente.** Mostrar `Uf = Kff⁻¹ · (Ff −
 * Kfr · Ur)` con una tabla por operando es la diferencia entre enunciar el paso
 * y mostrarlo. El proyecto original lo hacía, pero repitiendo `flex min-w-min
 * items-center` a mano en cada bloque; acá va una vez.
 *
 * **Nunca envuelve.** Una ecuación partida en dos renglones deja de leerse como
 * una ecuación, así que si no entra, scrollea. Eso además la hace inmune a la
 * deuda **D9**: los bloques de matrices en `flex-wrap` reacomodan las filas al
 * ensanchar una tabla —y el control de decimales se mueve bajo el cursor—,
 * mientras que acá el ancho crece hacia el scroll y las posiciones no cambian.
 *
 * **Pantalla completa** (`expand`), para las ecuaciones que son o pueden ser
 * grandes: la misma fila, con todo el ancho de la ventana. No se apila: lo que
 * enseña `F = K·U` es que el renglón *i* de `F`, el de `K` y el de `U` son el
 * mismo grado de libertad, y apilada se pierde (docs/armaduras-3d-v1.md,
 * decisión 1b). El botón está **siempre**, no solo cuando la ecuación no entra:
 * aparecer y desaparecer según los decimales sería otra cosa que se mueve.
 */
export function MatrixEquation({
  children,
  className,
  expand,
  header,
}: {
  children: ReactNode;
  className?: string;
  expand?: EquationExpand;
  /**
   * Lo que va pegado encima de la ecuación y tiene que seguir viéndose en
   * pantalla completa: la lectura del mapa de `K`, por ejemplo. Sin él, en la
   * ventana se vería el mapa pero no el número.
   */
  header?: ReactNode;
}) {
  const row = (
    <div className={cn("max-w-full overflow-x-auto pb-2", className)}>
      {/* `min-w-min` para que los operandos conserven su ancho natural en vez de
          comprimirse hasta entrar: es lo que hace que el contenedor scrollee. */}
      <div className="flex min-w-min items-center gap-3">{children}</div>
    </div>
  );
  if (!expand)
    return header ? (
      <div className="flex flex-col gap-2">
        {header}
        {row}
      </div>
    ) : (
      row
    );

  return (
    <div className="flex flex-col gap-2">
      <Dialog>
        <DialogTrigger asChild>
          {/* Pegado al principio y no al borde derecho: el ancho del bloque
              depende de los decimales, y un botón anclado a la derecha se
              correría al cambiarlos (ver docs/components.md). */}
          <Button variant="outline" size="sm" className="self-start">
            <Maximize2 />
            Pantalla completa
          </Button>
        </DialogTrigger>
        {/* Toda la ventana: el `DialogContent` de ui/ va centrado y a
            `sm:max-w-md`, y acá la idea es justamente ganar ancho. */}
        <DialogContent className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-4 sm:max-w-none">
          <DialogHeader className="pr-12">
            {/* `normal-case`: el título de ui/ va en mayúsculas y se come los nombres. */}
            <DialogTitle className="normal-case tracking-normal">{expand.title}</DialogTitle>
            <DialogDescription>
              {expand.description ?? "La misma ecuación, con todo el ancho de la pantalla."}
            </DialogDescription>
          </DialogHeader>
          {header}
          <div className="min-h-0 flex-1 overflow-auto">
            {/* `w-max` + `min-w-full`: centrada si entra, y si no, empieza en el
                borde izquierdo en vez de desbordar hacia los dos lados (un
                desborde a la izquierda no se puede scrollear). */}
            <div className="flex min-h-full w-max min-w-full items-center justify-center gap-3 pb-2">{children}</div>
          </div>
        </DialogContent>
      </Dialog>
      {header}
      {row}
    </div>
  );
}

/**
 * Un operador entre dos operandos de `MatrixEquation` (`=`, `\cdot`, `-`, `+`,
 * paréntesis). Va en TeX y no como texto suelto para que el símbolo tenga el
 * mismo peso tipográfico que el resto del álgebra de la página.
 */
export function MathOp({ tex, className }: { tex: string; className?: string }) {
  return <Math tex={tex} className={cn("shrink-0 text-lg", className)} />;
}

/**
 * Operando con su nombre encima (`Kff`, `Uf`, …). El nombre va en TeX; el
 * contenido es lo que sea que haya que mostrar, normalmente una `MatrixTable`.
 */
export function EquationTerm({ tex, children, className }: { tex?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex shrink-0 flex-col items-center gap-1", className)}>
      {tex && <Math tex={tex} className="text-sm" />}
      {children}
    </div>
  );
}

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Math } from "./math";

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
 */
export function MatrixEquation({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("max-w-full overflow-x-auto pb-2", className)}>
      {/* `min-w-min` para que los operandos conserven su ancho natural en vez de
          comprimirse hasta entrar: es lo que hace que el contenedor scrollee. */}
      <div className="flex min-w-min items-center gap-3">{children}</div>
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
export function EquationTerm({
  tex,
  children,
  className,
}: {
  tex?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 flex-col items-center gap-1", className)}>
      {tex && <Math tex={tex} className="text-sm" />}
      {children}
    </div>
  );
}

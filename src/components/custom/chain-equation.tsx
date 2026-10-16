"use client";

import { Fragment } from "react";
import { Rows3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Math, MathBlock } from "./math";
import { EquationTerm, MathOp, MatrixEquation } from "./matrix-equation";
import { MatrixTable } from "./matrix-table";

/**
 * Un operando de la cadena: su nombre en TeX y la matriz con sus rótulos. La
 * misma lista alimenta las dos vistas, así que la fila y la apilada no pueden
 * mostrar cosas distintas.
 */
export interface ChainTerm {
  tex: string;
  matrix: number[][];
  rowLabels: string[];
  colLabels: string[];
}

/**
 * Una cadena de productos, `K = A·k·Aᵀ`: en fila por defecto, como en el
 * pizarrón, y **apilada a pedido** en una ventana.
 *
 * En 2D la cadena de una barra entra en la página; en 3D (`A` de 6×2, `K` de
 * 6×6) a 1400 px ya corta `Aᵀ` a la mitad. Apilar acá sí sirve, a diferencia de
 * `F = K·U`: cada operando se lee entero por sí solo, y lo que importa es ver
 * los cuatro sin scrollear (docs/armaduras-3d-v1.md, decisión 1). El botón está
 * siempre, entre o no entre la fila.
 */
export function ChainEquation({ title, result, factors }: { title: string; result: ChainTerm; factors: ChainTerm[] }) {
  const symbolic = `${result.tex} = ${factors.map((f) => f.tex).join(String.raw` \cdot `)}`;

  return (
    <div className="flex flex-col gap-2">
      <Dialog>
        <DialogTrigger asChild>
          {/* Pegado al principio de la ecuación y no al borde derecho: el ancho
              del bloque depende de los decimales, y un botón anclado a la
              derecha se correría al cambiarlos (ver docs/components.md). */}
          <Button variant="outline" size="sm" className="self-start">
            <Rows3 />
            Ver apilada
          </Button>
        </DialogTrigger>
        {/* `sm:max-w-md` de ui/ deja las 6 columnas de K en dos renglones: se
            pisa el ancho, y el alto scrollea adentro de la ventana. */}
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            {/* `normal-case`: el título de ui/ va en mayúsculas y se come los nombres. */}
            <DialogTitle className="normal-case tracking-normal">{title}</DialogTitle>
            <DialogDescription>Los mismos operandos de la ecuación, uno debajo del otro.</DialogDescription>
          </DialogHeader>
          <MathBlock tex={symbolic} />
          <div className="flex flex-col gap-4">
            {factors.map((term) => (
              <StackedTerm key={term.tex} term={term} />
            ))}
            <StackedTerm term={result} />
          </div>
        </DialogContent>
      </Dialog>

      <MatrixEquation>
        <ChainOperand term={result} />
        <MathOp tex="=" />
        {factors.map((term, i) => (
          <Fragment key={term.tex}>
            {i > 0 && <MathOp tex="\cdot" />}
            <ChainOperand term={term} />
          </Fragment>
        ))}
      </MatrixEquation>
    </div>
  );
}

function ChainOperand({ term }: { term: ChainTerm }) {
  return (
    <EquationTerm tex={term.tex}>
      <MatrixTable matrix={term.matrix} rowLabels={term.rowLabels} colLabels={term.colLabels} />
    </EquationTerm>
  );
}

function StackedTerm({ term }: { term: ChainTerm }) {
  return (
    <div className="flex items-center gap-3">
      <Math tex={`${term.tex} =`} className="w-20 shrink-0 text-right" />
      <div className="max-w-full overflow-x-auto">
        <MatrixTable matrix={term.matrix} rowLabels={term.rowLabels} colLabels={term.colLabels} />
      </div>
    </div>
  );
}

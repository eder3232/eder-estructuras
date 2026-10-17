"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { MinusCircle, PlusCircle, RotateCcw } from "lucide-react";

import { FormulaInput } from "@/components/custom/formula-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CASES,
  atomAddCombination,
  atomCombinations,
  atomRemoveCombination,
  atomResetCombinations,
  atomUpdateCombination,
} from "../store/model";

/**
 * Las combinaciones de carga: por defecto las de la E.060 (9.2), editables.
 * Cada una es una suma de los tres casos por sus factores, y el sismo en el
 * otro sentido es el mismo caso con el factor cambiado de signo.
 */
export function CombinationsTable() {
  const combinations = useAtomValue(atomCombinations);
  const add = useSetAtom(atomAddCombination);
  const remove = useSetAtom(atomRemoveCombination);
  const update = useSetAtom(atomUpdateCombination);
  const reset = useSetAtom(atomResetCombinations);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-w-3xl flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Por defecto, las de la <strong>E.060 (2009), artículo 9.2</strong>: <code>1.4 CM + 1.7 CV</code> (9-1),{" "}
          <code>1.25 (CM + CV) ± CS</code> (9-4) y <code>0.9 CM ± CS</code> (9-5), con el ± escrito como dos
          combinaciones. El sismo entra con factor 1 porque las fuerzas de la E.030 ya están reducidas por R.
        </p>
        <p>
          <code>CS</code> positivo es el sismo hacia <code>+X</code> (a la derecha); con factor −1 es el mismo sismo
          hacia la izquierda. Se pueden cambiar los factores, agregar o quitar combinaciones: por ejemplo, si el
          curso usa otra norma.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => add()}>
          <PlusCircle /> Agregar una combinación
        </Button>
        <Button variant="outline" size="sm" onClick={() => reset()}>
          <RotateCcw /> Volver a las de la E.060
        </Button>
      </div>
      <div className="max-w-full overflow-x-auto">
        <Table className="w-auto border">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Nombre</TableHead>
              {CASES.map((c) => (
                <TableHead key={c.id} className="text-center">
                  {c.id}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {combinations.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Sin combinaciones no hay envolvente.
                </TableCell>
              </TableRow>
            )}
            {combinations.map((combination) => (
              <TableRow key={combination.id}>
                <TableCell>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => remove(combination.id)}
                    aria-label={`Eliminar ${combination.name}`}
                  >
                    <MinusCircle className="m-auto" />
                  </Button>
                </TableCell>
                <TableCell>
                  <Input
                    // El nombre por defecto es la fórmula: tiene que entrar entera.
                    className="w-52"
                    defaultValue={combination.name}
                    key={combination.name}
                    onBlur={(e) => update({ id: combination.id, name: e.target.value })}
                  />
                </TableCell>
                {CASES.map((c) => (
                  <TableCell key={c.id}>
                    <FormulaInput
                      className="w-20"
                      value={combination.factors[c.id] ?? 0}
                      onChange={(factor) => update({ id: combination.id, caseId: c.id, factor })}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

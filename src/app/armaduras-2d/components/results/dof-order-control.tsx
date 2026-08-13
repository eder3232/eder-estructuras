"use client";

import { useAtom, useSetAtom } from "jotai";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { atomRestrainedFirst, atomToggleRestrainedFirst } from "../../store/dof-order";

/**
 * El primero de los dos controles de orden que tenía el proyecto original.
 *
 * **Existe porque cada profesor ensambla a su manera**: unos ponen los grados
 * de libertad restringidos arriba de la matriz global y otros abajo.
 * Matemáticamente da exactamente lo mismo —los desplazamientos, las reacciones
 * y los esfuerzos no se mueven, y hay un test que lo fija— pero al que recién
 * aprende el método una matriz que no se parece a la del pizarrón lo
 * desorienta, y termina buscando un error que no existe.
 *
 * Va acá, pegado a la tabla de grados de libertad, porque es la primera
 * pantalla donde su efecto se ve: la tabla *es* el orden.
 */
export function DofOrderControl() {
  const [restrainedFirst] = useAtom(atomRestrainedFirst);
  const toggle = useSetAtom(atomToggleRestrainedFirst);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Checkbox id="restrained-first" checked={restrainedFirst} onCheckedChange={() => toggle()} />
        <Label htmlFor="restrained-first" className="font-normal">
          Los grados de libertad restringidos van arriba
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Cambia el orden en que se numeran y se ensambla la matriz global, para que se parezca a como lo hace tu
        profesor. Los resultados son los mismos: es la misma matriz con las filas y columnas permutadas.
      </p>
    </div>
  );
}

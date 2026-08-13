"use client";

import { useAtom } from "jotai";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { atomCompactNumbers } from "./number-scale";

/**
 * Enciende y apaga la notación compacta de las matrices (ver `number-scale.ts`).
 *
 * Va al lado del control de decimales porque es la otra mitad de la misma
 * decisión: cuántos dígitos se ven. Y existe como interruptor —en vez de ser
 * siempre compacta— por un caso de uso concreto de esta app: **cotejar contra un
 * ejercicio resuelto a mano**, donde el número tiene que estar escrito igual que
 * en el papel.
 */
export function CompactNumbersControl() {
  const [compact, setCompact] = useAtom(atomCompactNumbers);

  return (
    <div className="flex items-center gap-2 text-sm">
      <Switch id="compact-numbers" checked={compact} onCheckedChange={setCompact} />
      <Label htmlFor="compact-numbers" className="font-normal">
        Notación compacta
      </Label>
    </div>
  );
}

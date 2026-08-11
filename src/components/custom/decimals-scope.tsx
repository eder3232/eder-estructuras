"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAtom, useSetAtom } from "jotai";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { atomDecimals, atomDecimalsByScope, atomSetScopeDecimals } from "./decimals";

/**
 * Cascada de precisión: página → bloque → tabla. Cada nivel puede fijar su
 * número de decimales o heredar del de arriba.
 *
 * La herencia no necesita lógica de resolución propia: anidar providers *es* la
 * resolución, y `useDecimals()` devuelve el valor del ancestro más cercano. Lo
 * único que sí hace falta es que los overrides vivan en un átomo y no en un
 * `useState` local — el acordeón de resultados es Radix sin `forceMount`, así
 * que cerrar una sección desmonta sus tablas y con estado local se perdería lo
 * configurado.
 */
interface ScopeValue {
  /** Ruta acumulada desde la raíz; es la clave en `atomDecimalsByScope`. */
  path: string;
  /** Decimales ya resueltos para este ámbito. */
  value: number;
}

const ScopeContext = createContext<ScopeValue | null>(null);

export function DecimalsScope({ id, children }: { id: string; children: ReactNode }) {
  const parent = useContext(ScopeContext);
  const [pageDecimals] = useAtom(atomDecimals);
  const [byScope] = useAtom(atomDecimalsByScope);

  const path = parent ? `${parent.path}/${id}` : id;
  const value = byScope[path] ?? parent?.value ?? pageDecimals;

  return <ScopeContext.Provider value={{ path, value }}>{children}</ScopeContext.Provider>;
}

/** Decimales vigentes acá. Fuera de todo `DecimalsScope` cae en el valor de la página. */
export function useDecimals(): number {
  const scope = useContext(ScopeContext);
  const [pageDecimals] = useAtom(atomDecimals);
  return scope?.value ?? pageDecimals;
}

const OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const INHERIT = "inherit";

/**
 * Selector del ámbito en el que está montado — hay que ponerlo **dentro** del
 * `DecimalsScope` que controla. Cuando no hay override propio muestra "heredar"
 * con el valor que está recibiendo, para que se vea de dónde sale el número.
 */
export function ScopeDecimalsControl({ label, className }: { label?: string; className?: string }) {
  const scope = useContext(ScopeContext);
  const [byScope] = useAtom(atomDecimalsByScope);
  const setScopeDecimals = useSetAtom(atomSetScopeDecimals);

  if (!scope) return null;
  const override = byScope[scope.path];

  return (
    <div className={className ?? "flex items-center gap-2 text-sm"}>
      {label && <span className="text-muted-foreground">{label}</span>}
      <Select
        value={override === undefined ? INHERIT : String(override)}
        onValueChange={(next) =>
          setScopeDecimals({ path: scope.path, value: next === INHERIT ? null : Number(next) })
        }
      >
        <SelectTrigger size="sm" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={INHERIT}>heredar ({scope.value})</SelectItem>
          {OPTIONS.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

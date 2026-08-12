"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAtom, useSetAtom } from "jotai";
import { Minus, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  MAX_DECIMALS,
  MIN_DECIMALS,
  atomDecimals,
  atomDecimalsByScope,
  atomResetScopeDecimals,
  atomSetScopeDecimals,
  hasOverrides,
} from "./decimals";

/**
 * Cascada de precisión: página → bloque → tabla. Cada nivel puede fijar su
 * número de decimales o quedarse en automático, siguiendo al de arriba.
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
const AUTO = "auto";

/**
 * Control de bloque: un desplegable con etiqueta, más un botón para devolver la
 * sección y sus tablas a automático.
 *
 * La opción de herencia dice el efecto ("igual que la página") en vez del
 * mecanismo: "heredar" nombraba el árbol de ámbitos, que es un detalle de
 * implementación que nadie quiere tener en la cabeza mirando una matriz.
 */
export function ScopeDecimalsControl({
  label,
  /** De quién se copia el valor cuando está en automático, para poder decirlo. */
  inheritsFrom = "arriba",
}: {
  label?: string;
  inheritsFrom?: string;
}) {
  const scope = useContext(ScopeContext);
  const [byScope] = useAtom(atomDecimalsByScope);
  const setScopeDecimals = useSetAtom(atomSetScopeDecimals);
  const resetScope = useSetAtom(atomResetScopeDecimals);

  if (!scope) return null;
  const override = byScope[scope.path];
  const canReset = hasOverrides(byScope, scope.path);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {label && <span className="text-muted-foreground">{label}</span>}
      <Select
        value={override === undefined ? AUTO : String(override)}
        onValueChange={(next) =>
          setScopeDecimals({ path: scope.path, value: next === AUTO ? null : Number(next) })
        }
      >
        {/*
          El trigger no muestra el texto del item elegido, sino una forma corta.
          `SelectValue` sin children rinde el contenido del `SelectItem`
          seleccionado, y el de automático es una frase entera: entraba cortada a
          la mitad por el `line-clamp-1` del trigger y parecía la UI rota. La
          frase larga sirve en la lista abierta, no acá.

          Los dos estados se rotulan ("Auto (4)" / "Fijo (4)") y no se deja el
          dígito solo, por tres razones que van juntas: miden casi lo mismo, así
          que el ancho puede ser fijo y el ↺ de al lado no salta al elegir; con
          `justify-between` un dígito suelto dejaría el chevron flotando a 60 px;
          y el rótulo dice si la sección sigue a la página o está pinchada, que
          es justo lo que hay que saber sin abrir la lista.
        */}
        <SelectTrigger size="sm" className="w-22">
          <SelectValue>
            {override === undefined ? `Auto (${scope.value})` : `Fijo (${override})`}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTO}>Automático — igual que {inheritsFrom} ({scope.value})</SelectItem>
          {OPTIONS.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs text-muted-foreground"
        disabled={!canReset}
        onClick={() => resetScope({ path: scope.path })}
        title="Devuelve esta sección y todas sus tablas a automático"
      >
        <RotateCcw className="size-3" />
        Restablecer
      </Button>
    </div>
  );
}

/**
 * Control de tabla: `− n +`, del alto de una línea de texto.
 *
 * Es un stepper y no un desplegable por dos razones. Una es de uso: ajustar
 * precisión es tantear de a un decimal, no elegir un valor de una lista. La
 * otra es de peso visual — hay una tabla por barra y por paso de ensamblaje, y
 * con veintipico de desplegables idénticos en pantalla no se distinguía cuál
 * estaba tocado. Acá el número va en gris mientras sigue a la sección, y recién
 * cuando tiene valor propio se resalta y aparece el ↺ para soltarlo.
 *
 * **Al montarlo, no lo empujes al borde derecho de la tabla con
 * `justify-between`.** Subir decimales ensancha la tabla, y si el encabezado mide
 * lo que mide la tabla —el caso de todo bloque dentro de un `flex-wrap`—, el `+`
 * se corre solo y hay que reapuntar el mouse en cada click. Va pegado a su
 * etiqueta (`flex items-center gap-2`): así su posición depende del rótulo, que
 * no cambia. El orden interno `− n +` sigue esa misma regla — el ↺ aparece
 * después del `+`, y el número tiene ancho fijo (`w-4`), así que ni el `−` ni el
 * `+` se mueven al cambiar de valor.
 */
export function ScopeDecimalsStepper({ className }: { className?: string }) {
  const scope = useContext(ScopeContext);
  const [byScope] = useAtom(atomDecimalsByScope);
  const setScopeDecimals = useSetAtom(atomSetScopeDecimals);

  if (!scope) return null;
  const isAuto = byScope[scope.path] === undefined;
  const title = isAuto
    ? `Automático: sigue a la sección (${scope.value} decimales)`
    : `Fijado en ${scope.value} decimales, independiente de la sección`;

  return (
    <div className={cn("flex items-center", className)} title={title}>
      <Button
        variant="ghost"
        size="icon"
        className="size-5 text-muted-foreground"
        disabled={scope.value <= MIN_DECIMALS}
        onClick={() => setScopeDecimals({ path: scope.path, value: scope.value - 1 })}
        aria-label="Un decimal menos en esta tabla"
      >
        <Minus className="size-3" />
      </Button>
      <span
        className={cn(
          "w-4 text-center text-xs tabular-nums",
          isAuto ? "text-muted-foreground" : "font-semibold text-foreground",
        )}
      >
        {scope.value}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-5 text-muted-foreground"
        disabled={scope.value >= MAX_DECIMALS}
        onClick={() => setScopeDecimals({ path: scope.path, value: scope.value + 1 })}
        aria-label="Un decimal más en esta tabla"
      >
        <Plus className="size-3" />
      </Button>
      {!isAuto && (
        <Button
          variant="ghost"
          size="icon"
          className="size-5 text-muted-foreground"
          onClick={() => setScopeDecimals({ path: scope.path, value: null })}
          aria-label="Volver a seguir a la sección"
          title="Volver a seguir a la sección"
        >
          <RotateCcw className="size-3" />
        </Button>
      )}
    </div>
  );
}

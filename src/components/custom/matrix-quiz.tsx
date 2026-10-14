"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDecimals } from "./decimals-scope";
import {
  cellKey,
  checkPositions,
  checkValue,
  countOk,
  type CellKey,
  type CellStatus,
} from "./matrix-quiz-check";

/**
 * Las dos grillas del modo práctica.
 *
 * **Por qué son un componente aparte de `MatrixTable`.** Esa renderiza texto y
 * ya carga tres cosas: la cascada de decimales, la notación compacta y las
 * etiquetas fijas. Meterle además modos de edición la convertiría en dos
 * componentes disfrazados de uno, y el resaltado por celda —que acá significa
 * "está bien" o "te falta"— chocaría con el que ya usa para las zonas de la
 * partición.
 *
 * Lo que sí comparten es el criterio: etiquetas nudo+eje en filas y columnas, y
 * la corrección en `matrix-quiz-check.ts`, que es pura y está testeada aparte.
 */

const CELL = "border px-2 py-1 text-center text-sm tabular-nums";
const HEADER = "border px-2 py-1 text-center text-sm font-medium text-muted-foreground";

/**
 * Ejercicio 1: marcar en qué posiciones de la matriz global aporta una barra.
 *
 * Es el paso donde más se confunden —el mapeo barra → posiciones— y se resuelve
 * con clicks en vez de tipeo, así que se puede hacer de memoria y rápido, que es
 * como conviene practicar algo que después hay que hacer doce veces seguidas.
 */
export function PositionsQuiz({
  labels,
  expected,
  title,
  instruction = "hacé click en cada posición de la matriz global donde esa barra suma algo.",
}: {
  labels: string[];
  expected: CellKey[];
  title: string;
  /** Qué hay que hacer, en el idioma del sistema (en resortes no hay «barras»). */
  instruction?: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<CellKey>>(new Set());
  const [checked, setChecked] = useState(false);

  const result = checked ? checkPositions(selected, expected) : null;
  const statusOf = (key: CellKey) => {
    if (!result) return selected.has(key) ? "marcada" : "libre";
    if (result.hit.includes(key)) return "bien";
    if (result.missing.includes(key)) return "falta";
    if (result.extra.includes(key)) return "sobra";
    return "libre";
  };

  function toggle(key: CellKey) {
    setChecked(false);
    setSelected((antes) => {
      const ahora = new Set(antes);
      if (ahora.has(key)) ahora.delete(key);
      else ahora.add(key);
      return ahora;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        <span className="font-medium">{title}</span> — {instruction}
      </p>

      <div className="max-w-full overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="w-8" />
              {labels.map((label) => (
                <th key={label} className={HEADER}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((rowLabel, i) => (
              <tr key={rowLabel}>
                <th className={HEADER}>{rowLabel}</th>
                {labels.map((colLabel, j) => {
                  const key = cellKey(i, j);
                  const status = statusOf(key);
                  return (
                    <td key={colLabel} className="p-0">
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        aria-label={`${rowLabel} con ${colLabel}`}
                        aria-pressed={selected.has(key)}
                        className={cn(
                          CELL,
                          "block w-full cursor-pointer hover:bg-muted",
                          status === "marcada" && "bg-primary/30",
                          status === "bien" && "bg-emerald-500/40 font-semibold",
                          // Faltante y sobrante se distinguen: son dos errores
                          // distintos y se corrigen distinto.
                          status === "falta" && "bg-amber-500/40",
                          status === "sobra" && "bg-destructive/40 line-through",
                        )}
                      >
                        {status === "bien" || status === "sobra" || status === "marcada" ? "×" : " "}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => setChecked(true)}>
          Verificar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSelected(new Set());
            setChecked(false);
          }}
        >
          Empezar de nuevo
        </Button>
        {result && (
          <span className="text-sm">
            {result.missing.length === 0 && result.extra.length === 0 ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Las {expected.length} posiciones, bien.
              </span>
            ) : (
              <>
                <span className="font-medium">{result.hit.length}</span> de {expected.length} bien
                {result.missing.length > 0 && <> · faltan {result.missing.length} (en ámbar)</>}
                {result.extra.length > 0 && <> · sobran {result.extra.length} (tachadas)</>}
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Ejercicio 2: completar los valores de la matriz de una barra.
 *
 * Acepta expresiones, así que se puede escribir `2e7*0.001/3` en vez del número
 * ya resuelto: es como el alumno tiene el valor mientras lo está calculando.
 */
const ARMADURAS_VALUES_INSTRUCTION = (
  <>
    completá la matriz de rigidez de esa barra en ejes globales. Podés escribir la cuenta (
    <code className="text-xs">2e7*0.001/3</code>) en vez del resultado.
  </>
);

export function ValuesQuiz({
  rowLabels,
  colLabels,
  expected,
  title,
  instruction = ARMADURAS_VALUES_INSTRUCTION,
}: {
  rowLabels: string[];
  colLabels: string[];
  expected: number[][];
  title: string;
  /** Qué hay que hacer, en el idioma del sistema. */
  instruction?: ReactNode;
}) {
  const decimals = useDecimals();
  const [entries, setEntries] = useState<Record<CellKey, string>>({});
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const statuses: CellStatus[] = expected.flatMap((row, i) =>
    row.map((value, j) => checkValue(entries[cellKey(i, j)] ?? "", value)),
  );
  const total = expected.length * (expected[0]?.length ?? 0);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        <span className="font-medium">{title}</span> — {instruction}
      </p>

      <div className="max-w-full overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="w-8" />
              {colLabels.map((label) => (
                <th key={label} className={HEADER}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expected.map((row, i) => (
              <tr key={rowLabels[i]}>
                <th className={HEADER}>{rowLabels[i]}</th>
                {row.map((value, j) => {
                  const key = cellKey(i, j);
                  const status = checked ? checkValue(entries[key] ?? "", value) : null;
                  return (
                    <td key={colLabels[j]} className="border p-0.5">
                      {revealed ? (
                        <span className="block px-2 py-1 text-right text-sm tabular-nums text-muted-foreground">
                          {value.toFixed(decimals)}
                        </span>
                      ) : (
                        <Input
                          value={entries[key] ?? ""}
                          onChange={(e) => {
                            setChecked(false);
                            setEntries((antes) => ({ ...antes, [key]: e.target.value }));
                          }}
                          aria-label={`${rowLabels[i]} con ${colLabels[j]}`}
                          className={cn(
                            "h-8 w-28 border-0 text-right text-sm shadow-none tabular-nums focus-visible:ring-1",
                            status === "ok" && "bg-emerald-500/25",
                            status === "wrong" && "bg-destructive/25",
                            status === "invalid" && "bg-amber-500/25",
                          )}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => setChecked(true)} disabled={revealed}>
          Verificar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRevealed((antes) => !antes)}>
          {revealed ? "Volver a intentar" : "Mostrar solución"}
        </Button>
        {checked && !revealed && (
          <span className="text-sm">
            {countOk(statuses) === total ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Las {total} celdas, bien.
              </span>
            ) : (
              <>
                <span className="font-medium">{countOk(statuses)}</span> de {total} bien
                {statuses.includes("invalid") && <> · hay algo que no es un número (en ámbar)</>}
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

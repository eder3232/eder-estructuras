import { atom } from "jotai";
import { produce } from "immer";

/**
 * Precisión de la página: el piso de la cascada, y lo único que existía antes.
 * La usa cualquier componente que no esté dentro de un `DecimalsScope`.
 */
export const atomDecimals = atom(4);

/**
 * Overrides por ámbito, indexados por la ruta que arma `DecimalsScope`
 * (`armaduras-2d/partition/kff`). Que la clave sea la ruta completa y no un id
 * suelto evita que dos sistemas con nombres de bloque iguales —o dos barras con
 * el mismo id semilla en 2D y en 3D— se pisen la configuración.
 *
 * Una clave ausente significa "heredar", que **no** es lo mismo que guardar el
 * valor heredado: si después cambia el bloque, el que hereda sigue al bloque.
 */
export const atomDecimalsByScope = atom<Record<string, number>>({});

export const atomSetScopeDecimals = atom(
  null,
  (get, set, { path, value }: { path: string; value: number | null }) => {
    set(
      atomDecimalsByScope,
      produce((draft: Record<string, number>) => {
        if (value === null) delete draft[path];
        else draft[path] = value;
      }),
    );
  },
);

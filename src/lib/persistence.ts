/**
 * Guardar y recuperar estado del navegador, con versión.
 *
 * Es genérico a propósito: cada sistema guarda su modelo con su propia clave y
 * su propia guarda de forma, pero el sobre —la versión, el descarte de lo que
 * no se entiende, el no romper nunca— es el mismo para los cuatro.
 *
 * **La versión va adentro del payload y no en la clave.** Con la versión en la
 * clave, un modelo viejo queda huérfano en el almacenamiento y nadie se entera;
 * adentro, al leerlo hay que mirarlo y decidir a conciencia — migrarlo o
 * descartarlo diciéndolo.
 */

interface Envelope {
  v: number;
  data: unknown;
}

export interface LoadResult<T> {
  data: T | null;
  /**
   * Había algo guardado y **no se pudo usar** — otra versión, JSON roto, o una
   * forma que no pasa la guarda. Es distinto de "no había nada", y hay que
   * poder distinguirlos: lo primero se avisa, lo segundo es la primera visita.
   */
  discarded: boolean;
}

const EMPTY = { data: null, discarded: false } as const;

/**
 * Lee lo guardado, o `null` si no hay nada usable.
 *
 * En el servidor devuelve vacío sin tocar nada: estas páginas se prerrenderizan,
 * así que este módulo se evalúa también ahí.
 */
export function loadPersisted<T>(
  key: string,
  version: number,
  isValid: (value: unknown) => value is T,
): LoadResult<T> {
  if (typeof window === "undefined") return EMPTY;

  const raw = window.localStorage.getItem(key);
  if (raw === null) return EMPTY;

  let envelope: Envelope;
  try {
    envelope = JSON.parse(raw) as Envelope;
  } catch {
    return { data: null, discarded: true };
  }

  // Una versión distinta —vieja o **más nueva que este código**, que pasa si el
  // usuario abre una pestaña con la app anterior— no se adivina: se descarta y
  // se dice. El día que haya una migración de verdad, va acá.
  if (envelope === null || typeof envelope !== "object" || envelope.v !== version) {
    return { data: null, discarded: true };
  }

  return isValid(envelope.data) ? { data: envelope.data, discarded: false } : { data: null, discarded: true };
}

export function savePersisted<T>(key: string, version: number, data: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify({ v: version, data } satisfies Envelope));
}

export function clearPersisted(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

"use client";

import { useSyncExternalStore } from "react";

/** Nada que escuchar: el valor cambia una sola vez, al hidratar. */
const subscribe = () => () => {};

/**
 * `false` mientras se rinde en el servidor y durante la hidratación, `true`
 * apenas React toma el control en el navegador.
 *
 * **Para qué**: el modelo guardado vive en `localStorage`, que en el servidor no
 * existe, así que el HTML prerrenderizado no puede tenerlo. Si las tablas se
 * dibujaran igual, el alumno vería el ejemplo inicial por un instante y recién
 * después su modelo — y en una app de estudio eso se lee como *se perdió mi
 * trabajo*. Con esto se reserva el espacio y no se muestra un dato que no es
 * suyo ni por un cuadro.
 *
 * **Y va con `useSyncExternalStore` y no con el `useState` + `useEffect` de
 * "mounted"**, que es el patrón habitual: ese es exactamente la regla
 * `react-hooks/set-state-in-effect` de los 2 errores de lint preexistentes en
 * `ui/`, y un tercero rompería el criterio de "si aparece otro, ese sí es
 * nuevo". Acá React hace el segundo render solo, sin estado de por medio.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

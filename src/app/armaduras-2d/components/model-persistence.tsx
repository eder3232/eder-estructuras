"use client";

import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { atomPersistableModel, atomResetModel, atomRestoreModel } from "../store/persistence";
import { saveModel, storedModelDiscarded } from "../store/persisted-model";

/**
 * Guarda el modelo en cada cambio.
 *
 * **Es un efecto y está bien que lo sea**: escribir en `localStorage` es
 * sincronizar con un sistema externo, que es para lo que existen los efectos.
 * Lo que el repo evita es *setear estado* adentro de uno —la regla
 * `react-hooks/set-state-in-effect`—, y acá no se setea nada.
 *
 * **No lleva debounce**, y es deliberado: son un par de kB y `localStorage` es
 * síncrono y barato. El proyecto original tenía un "debouncer" que no era un
 * debounce y que además tapaba un bug de input (ver `docs/errores.md`); si
 * alguna vez hiciera falta, primero se mide.
 */
export function ModelPersistence() {
  const model = useAtomValue(atomPersistableModel);

  useEffect(() => {
    saveModel(model);
  }, [model]);

  useEffect(() => {
    if (!storedModelDiscarded || avisado) return;
    // Una vez por carga: en desarrollo React monta dos veces, y el aviso
    // duplicado se ve como un error de la app.
    avisado = true;
    toast.warning("No se pudo recuperar lo que tenías guardado", {
      description: "Lo guardado quedó de una versión anterior de la app. Se arrancó con el ejemplo inicial.",
      duration: 10000,
    });
  }, []);

  return null;
}

let avisado = false;

/**
 * Volver al ejemplo inicial.
 *
 * **Con "deshacer" y no con un diálogo de confirmación**, que fue la decisión:
 * un diálogo frena al que sabe lo que quiere y no salva más que el undo, que
 * salva también al que se dio cuenta tres segundos después. El estado anterior
 * viaja en el cierre del toast — el mismo mecanismo que va a necesitar N2 para
 * cargar un ejemplo encima de lo que el usuario tenía.
 */
export function ResetModelButton() {
  const reset = useSetAtom(atomResetModel);
  const restore = useSetAtom(atomRestoreModel);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const previo = reset();
        toast("Volviste al ejemplo inicial", {
          // Sin descripción a propósito: en tipografía monoespaciada el texto
          // llega hasta el botón de acción y lo empuja encima del renglón. El
          // título ya lo dice todo, y el botón dice el resto.
          duration: 10000,
          action: {
            label: "Deshacer",
            onClick: () => restore(previo),
          },
        });
      }}
    >
      <RotateCcw />
      Volver al ejemplo inicial
    </Button>
  );
}

"use client";

import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { BookOpen, ChevronDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { examples } from "../store/examples";
import { atomPersistableModel, atomReplaceModel, atomResetModel, atomRestoreModel } from "../store/persistence";
import { saveModel, storedModelDiscarded, type PersistedModel } from "../store/persisted-model";

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
 * Avisar que se reemplazó el modelo, **con la vuelta atrás adentro del aviso**.
 *
 * Esa fue la decisión, y vale para las dos acciones que pisan todo —volver al
 * ejemplo inicial y cargar un ejemplo—: un diálogo de confirmación frena al que
 * sabe lo que quiere y no salva más que el undo, que salva también al que se
 * dio cuenta tres segundos después.
 */
function avisarConDeshacer(mensaje: string, previo: PersistedModel, restore: (model: PersistedModel) => void) {
  toast(mensaje, {
    // Sin descripción a propósito: en tipografía monoespaciada el texto llega
    // hasta el botón de acción y lo empuja encima del renglón. El título ya lo
    // dice todo, y el botón dice el resto.
    duration: 10000,
    action: {
      label: "Deshacer",
      onClick: () => restore(previo),
    },
  });
}

/** Volver al ejemplo inicial. */
export function ResetModelButton() {
  const reset = useSetAtom(atomResetModel);
  const restore = useSetAtom(atomRestoreModel);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => avisarConDeshacer("Volviste al ejemplo inicial", reset(), restore)}
    >
      <RotateCcw />
      Volver al ejemplo inicial
    </Button>
  );
}

/**
 * Los ejemplos precargados (N2).
 *
 * **Es un menú y no un desplegable de selección**: un `Select` dice "el valor
 * actual es este", y acá no hay valor actual — apenas se carga un ejemplo, el
 * alumno lo edita y deja de serlo. Lo que hay es una acción que se dispara.
 *
 * Cada item lleva **qué muestra ese ejemplo y no otro**, que es la única razón
 * por la que existe la lista: tres armaduras cualesquiera no enseñarían nada
 * que el ejemplo inicial no enseñe ya.
 */
export function ExamplesMenu() {
  const replace = useSetAtom(atomReplaceModel);
  const restore = useSetAtom(atomRestoreModel);

  return (
    <DropdownMenu>
      {/* `asChild` y no `render`: este componente es de Radix. El combobox de
          U2, que es de Base UI, usa la otra API — conviene mirar el import
          antes de copiar un patrón de un archivo a otro. */}
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen />
          Ejemplos
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      {/*
        `w-96` porque `DropdownMenuContent` fija el ancho **al del disparador**
        (`w-(--radix-dropdown-menu-trigger-width)`): sin esto el menú sale del
        ancho del botón «Ejemplos» y cada descripción se parte en cinco
        renglones. Lo encontró la captura.
      */}
      <DropdownMenuContent align="end" className="w-96">
        {examples.map((example) => (
          <DropdownMenuItem
            key={example.id}
            className="flex-col items-start gap-0.5"
            onClick={() => avisarConDeshacer(`Cargaste «${example.name}»`, replace(example.model), restore)}
          >
            <span className="font-medium">{example.name}</span>
            {/* `normal-case` porque `DropdownMenuItem` aplica `uppercase` —la
                tipografía de este fork para menús, que está bien para el
                nombre y no para una oración—. Es la tercera vez que un
                `uppercase` de `ui/` aparece donde no corresponde: antes fue
                `EmptyTitle` con los símbolos de KaTeX. */}
            <span className="text-xs tracking-normal whitespace-normal normal-case text-muted-foreground">
              {example.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

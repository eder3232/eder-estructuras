"use client";

import { useEffect } from "react";
import { BookOpen, ChevronDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * La persistencia de un modelo (N1) y los ejemplos precargados (N2), sin saber
 * de qué sistema son: el modelo de cada uno entra y sale por props. Nació en
 * `/armaduras-2d` y se volvió genérica al llevarla a `/springs` (2026-10-14).
 */

/** Un ejemplo para cargar, con **qué muestra este y no otro** (es lo que se lee en el menú). */
export interface ModelExample<Model> {
  id: string;
  name: string;
  description: string;
  model: Model;
}

/** Los avisos de "no se pudo recuperar" ya dados en esta carga, por clave de guardado. */
const avisados = new Set<string>();

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
export function ModelPersistence<Model>({
  model,
  save,
  storageKey,
  discarded,
}: {
  model: Model;
  save: (model: Model) => void;
  /** Identifica el aviso: cada sistema avisa una vez por carga. */
  storageKey: string;
  /** Había algo guardado y no se pudo usar. Se avisa, no se esconde. */
  discarded: boolean;
}) {
  useEffect(() => {
    save(model);
  }, [model, save]);

  useEffect(() => {
    if (!discarded || avisados.has(storageKey)) return;
    // Una vez por carga: en desarrollo React monta dos veces, y el aviso
    // duplicado se ve como un error de la app.
    avisados.add(storageKey);
    toast.warning("No se pudo recuperar lo que tenías guardado", {
      description: "Lo guardado quedó de una versión anterior de la app. Se arrancó con el ejemplo inicial.",
      duration: 10000,
    });
  }, [discarded, storageKey]);

  return null;
}

/**
 * Avisar que se reemplazó el modelo, **con la vuelta atrás adentro del aviso**.
 *
 * Esa fue la decisión, y vale para las dos acciones que pisan todo —volver al
 * ejemplo inicial y cargar un ejemplo—: un diálogo de confirmación frena al que
 * sabe lo que quiere y no salva más que el undo, que salva también al que se
 * dio cuenta tres segundos después.
 */
function avisarConDeshacer<Model>(mensaje: string, previo: Model, restore: (model: Model) => void) {
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

/** Volver al ejemplo inicial. `onReset` devuelve el modelo que había, para poder deshacer. */
export function ResetModelButton<Model>({
  onReset,
  onRestore,
}: {
  onReset: () => Model;
  onRestore: (model: Model) => void;
}) {
  return (
    <Button variant="outline" size="sm" onClick={() => avisarConDeshacer("Volviste al ejemplo inicial", onReset(), onRestore)}>
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
 * por la que existe la lista.
 */
export function ExamplesMenu<Model>({
  examples,
  onReplace,
  onRestore,
  align = "end",
}: {
  examples: ModelExample<Model>[];
  /**
   * De qué lado del botón se abre. `end` sirve cuando los botones están a la
   * derecha del título (`/armaduras-2d`); en una página más angosta bajan
   * debajo del título, a la izquierda, y abrir hacia el final mandaba el menú
   * afuera de la columna. Lo encontró la captura de `/springs`.
   */
  align?: "start" | "end";
  /** Carga el ejemplo y devuelve el modelo que había, para poder deshacer. */
  onReplace: (model: Model) => Model;
  onRestore: (model: Model) => void;
}) {
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
      <DropdownMenuContent align={align} className="w-96">
        {examples.map((example) => (
          <DropdownMenuItem
            key={example.id}
            className="flex-col items-start gap-0.5"
            onClick={() => avisarConDeshacer(`Cargaste «${example.name}»`, onReplace(example.model), onRestore)}
          >
            <span className="font-medium">{example.name}</span>
            {/* `normal-case` porque `DropdownMenuItem` aplica `uppercase` —la
                tipografía de este fork para menús, que está bien para el
                nombre y no para una oración—. */}
            <span className="text-xs tracking-normal whitespace-normal normal-case text-muted-foreground">
              {example.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

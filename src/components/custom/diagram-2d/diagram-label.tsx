import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DiagramLabelProps {
  x: number;
  y: number;
  /** Unidad de referencia del diagrama: fija el tamaño de fuente y, con él, el del halo. */
  unitSize: number;
  anchor?: "start" | "middle" | "end";
  baseline?: "auto" | "middle" | "hanging";
  /** Color del texto (`fill-*`). El halo siempre es del color del fondo. */
  className?: string;
  children: ReactNode;
}

/**
 * Texto de un diagrama, con halo del color del fondo.
 *
 * **Por qué todo el texto pasa por acá.** Un diagrama estructural no tiene lugar
 * libre garantizado: la etiqueta de una fuerza cae donde la lleve su flecha, y
 * ahí puede haber una barra, otra etiqueta o un apoyo. Correr las etiquetas
 * resuelve los choques *previsibles* (ver `force-arrow.tsx`), pero no los que
 * dependen de la geometría que cargue el usuario. El halo resuelve el resto:
 * el texto se lee aunque tenga una barra atrás.
 *
 * Es `paint-order: stroke` y no un rectángulo de fondo porque sigue la forma de
 * las letras — un rectángulo taparía la barra en un bloque y se vería como un
 * parche. El `stroke-linejoin: round` evita las púas en los vértices agudos.
 *
 * El halo usa `background` (el fondo de la página) y no el del lienzo, que es
 * `bg-muted/20`, o sea una mezcla sin token propio. Medido sobre una captura en
 * oscuro, la diferencia entre los dos es de 6/255 por canal: a lo ancho de un
 * trazo de este grosor no se distingue.
 */
export function DiagramLabel({
  x,
  y,
  unitSize,
  anchor = "middle",
  baseline = "middle",
  className,
  children,
}: DiagramLabelProps) {
  return (
    <text
      x={x}
      y={y}
      fontSize={unitSize}
      textAnchor={anchor}
      dominantBaseline={baseline}
      // Sin `vector-effect`: el halo tiene que escalar con la figura igual que
      // la fuente, si no cambia de grosor relativo según el zoom del viewBox.
      //
      // El grosor tiene que **cerrar los huecos entre letras**, no solo rodear
      // cada una. Con 0.3 una barra que cruzaba una etiqueta se seguía viendo
      // entre los caracteres —la diagonal `e6` partía en dos el `-6.4000` del
      // nudo v3 en el ejemplo inicial— y el número se leía cortado.
      strokeWidth={unitSize * 0.5}
      className={cn("stroke-background [paint-order:stroke] [stroke-linejoin:round]", className)}
    >
      {children}
    </text>
  );
}

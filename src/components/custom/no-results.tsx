import type { ReactNode } from "react";
import { CircleSlash, TableProperties } from "lucide-react";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/**
 * Lo que va en el lugar de los resultados cuando no hay resultados.
 *
 * Un panel que devuelve `null` deja el título de la sección con sus controles
 * al lado y nada debajo: se lee como si la app se hubiera roto, cuando lo que
 * pasa es que el modelo todavía no se puede resolver. Acá se dice por qué.
 *
 * Presentación pura, como el `ErrorsPanel` genérico: el estado de cada sistema
 * vive en su propio átomo, así que el adaptador que lo lee va en
 * `src/app/<sistema>/components/` y esto solo dibuja.
 */
export function NoResults({
  tone,
  title,
  children,
  detail,
}: {
  /** `empty` = todavía no hay nada que calcular; `error` = no se pudo. */
  tone: "empty" | "error";
  title: string;
  /** La explicación breve, centrada bajo el título. */
  children?: ReactNode;
  /**
   * Contenido ancho y alineado a la izquierda debajo del encabezado, para
   * cuando el "por qué" es más que una frase — un diagnóstico con su dibujo,
   * por ejemplo. `EmptyContent` no sirve para eso: mide `max-w-sm` y centra.
   */
  detail?: ReactNode;
}) {
  const Icon = tone === "error" ? CircleSlash : TableProperties;

  return (
    // `Empty` de shadcn trae `border-dashed` pero **no** `border`: sin esto el
    // recuadro punteado no se dibuja. El aspecto es el mismo que ya tenía el
    // bloque del mecanismo, que nació suelto.
    <Empty className="rounded-md border p-8">
      <EmptyHeader className="max-w-2xl">
        <EmptyMedia variant="icon" className={cn(tone === "error" && "text-destructive")}>
          <Icon />
        </EmptyMedia>
        {/*
          `EmptyTitle` aplica `uppercase`. Es la misma trampa que ya costó una
          vez con KaTeX (ver docs/components.md): cualquier cosa cuyo texto
          exacto importe —el nombre de un nudo, un eje, un símbolo— va en la
          descripción, nunca acá.
        */}
        <EmptyTitle className={cn(tone === "error" && "text-destructive")}>{title}</EmptyTitle>
        {children && <EmptyDescription className="text-pretty">{children}</EmptyDescription>}
      </EmptyHeader>
      {detail && <div className="w-full text-left">{detail}</div>}
    </Empty>
  );
}

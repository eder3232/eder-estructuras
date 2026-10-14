import type { ComponentProps } from "react";

import { AccordionContent as BaseAccordionContent } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export { Accordion, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/**
 * El `AccordionContent` de `ui/` con **una sola diferencia**: el contenido
 * crece después de abierto.
 *
 * El original le pone al `div` interno `h-(--radix-accordion-content-height)`,
 * o sea el alto que Radix midió **al abrir la sección**, y el contenedor lleva
 * `overflow-hidden`. Todo lo que aparezca después queda cortado sin aviso: el
 * modo práctica al encenderlo, un ejercicio que muestra su corrección. Se
 * encontró midiendo en `/springs` (2026-10-14) y pasaba igual en
 * `/armaduras-2d`, donde nunca se había visto porque headless no hacía clicks.
 *
 * `h-auto` le gana al alto fijo vía `tailwind-merge`. La animación de abrir y
 * cerrar no cambia: la hace el contenedor de afuera, no este `div`.
 */
export function AccordionContent({ className, ...props }: ComponentProps<typeof BaseAccordionContent>) {
  return <BaseAccordionContent className={cn("h-auto", className)} {...props} />;
}

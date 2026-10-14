"use client";

import { ScopeDecimalsControl } from "@/components/custom/decimals-scope";

/**
 * Encabezado de precisión de una sección. La leyenda va una sola vez por
 * bloque, y no repetida en cada tabla: explicar la cascada veintipico de veces
 * era justamente lo que hacía ilegible la pantalla.
 */
export function SectionDecimals({
  label = "Decimales de esta sección:",
  hint = true,
}: {
  label?: string;
  hint?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <ScopeDecimalsControl label={label} inheritsFrom="la página" />
      {hint && (
        <p className="text-xs text-muted-foreground">
          Cada tabla sigue a la sección salvo que le fijes un número con − / +. El ↺ la vuelve a soltar.
        </p>
      )}
    </div>
  );
}

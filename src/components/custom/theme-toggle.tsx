"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * Botón de un solo click que alterna claro ↔ oscuro.
 *
 * **Por qué los dos iconos están siempre en el DOM y se ocultan por CSS.** El
 * patrón habitual para esto es un `useState(false)` + `useEffect(() => setMounted(true))`,
 * porque en el primer render del servidor todavía no se sabe qué tema eligió el
 * usuario. Acá no se puede: la regla `react-hooks/set-state-in-effect` lo marca
 * como error, y el repo tiene exactamente 2 errores de lint preexistentes en
 * `ui/` — un tercero dejaría de ser distinguible de una regresión (ver el README).
 *
 * Dibujar los dos iconos y dejar que `dark:` decida cuál se ve resuelve las dos
 * cosas a la vez: el markup es idéntico en servidor y cliente (o sea, no hay
 * desajuste de hidratación que suprimir) y el icono correcto aparece en el mismo
 * paint en que se aplica el tema, sin parpadeo.
 *
 * `resolvedTheme` solo se lee dentro del handler, que corre después de montar,
 * así que nunca participa del render.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Cambiar entre modo claro y oscuro"
      title="Cambiar entre modo claro y oscuro"
    >
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  );
}

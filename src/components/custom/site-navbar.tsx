import Link from "next/link";

import { ThemeToggle } from "@/components/custom/theme-toggle";
import { siteConfig, systemLinks, theoryLinks } from "@/lib/site-config";

/**
 * Barra de navegación **provisional**.
 *
 * Existe porque el toggle de tema tenía que vivir en algún lado y hasta ahora no
 * había ninguna navegación: desde un sistema no se volvía a `/` salvo con el
 * botón del navegador. Es a propósito lo más simple que resuelve eso.
 *
 * La navegación de verdad es el punto **S2** de `docs/pendientes-comparacion.md`,
 * y su decisión abierta no es "poner una navbar" sino si los sistemas y el
 * contenido educativo (Fase 8) comparten layout o si cada zona quiere el suyo
 * —probablemente con un route group `(programs)`—. Eso se decide antes de la
 * Fase 8, no acá. Cuando se decida, este componente se reemplaza.
 *
 * Sin estado de link activo por la misma razón: pedirlo obligaría a `usePathname`
 * y a volver cliente toda la barra, que es justo el tipo de decisión que conviene
 * tomar con el diseño definitivo y no con este.
 */
export function SiteNavbar() {
  return (
    <header className="border-b">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-6 px-6 py-3">
        <Link href="/" className="font-heading font-bold">
          {siteConfig.name}
        </Link>
        <ul className="flex flex-1 flex-wrap items-center gap-4">
          {systemLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
          {theoryLinks.map((link) => (
            <li key={link.href} className="border-l pl-4">
              <Link
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <ThemeToggle />
      </nav>
    </header>
  );
}

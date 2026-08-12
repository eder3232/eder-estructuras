"use client";

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

/**
 * Envoltorio de `next-themes` para poder montarlo desde el `layout.tsx`, que es
 * un Server Component: el provider usa contexto de React y necesita el
 * `"use client"` de este archivo.
 *
 * El paquete estaba en `package.json` desde el principio pero **nunca se había
 * montado**, así que los tokens `.dark` de `globals.css` eran código muerto y el
 * modo oscuro no se podía activar en ninguna página.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

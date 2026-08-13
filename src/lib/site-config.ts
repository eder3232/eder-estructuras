/**
 * Identidad de la app, en un solo lugar.
 *
 * El proyecto original centralizaba esto mismo en un `siteConfig`; acá se
 * mantiene esa idea porque el nombre aparece en tres lados que se desincronizan
 * solos si cada uno lo escribe a mano: la metadata de `layout.tsx`, la barra de
 * navegación y el encabezado de la home.
 */
export const siteConfig = {
  name: "Eder Estructuras",
  description:
    "Análisis estructural por el método matricial de rigideces: resortes, armaduras planas y espaciales, y pórticos planos, mostrando el paso a paso del cálculo.",
} as const;

/** Los sistemas estructurales que hoy tienen página propia. */
export const systemLinks = [
  { href: "/springs", label: "Resortes" },
  { href: "/armaduras-2d", label: "Armaduras 2D" },
  { href: "/armaduras-3d", label: "Armaduras 3D" },
  { href: "/frame2d", label: "Pórticos 2D" },
] as const;

/**
 * Páginas de teoría, que **no** son un sistema estructural y por eso van en su
 * propia lista: la navegación definitiva (S2) tiene que poder distinguirlas, y
 * meterlas entre los sistemas ahora sería decidir de costado que van al mismo
 * nivel.
 */
export const theoryLinks = [{ href: "/estabilidad", label: "Estabilidad" }] as const;

import {
  ArrowRight,
  FileSpreadsheet,
  GraduationCap,
  HardDrive,
  ListOrdered,
  MousePointerClick,
  Sigma,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Math, MathBlock } from "@/components/custom/math";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

import heroImage from "./_home/images/hero.webp";
import { homeSystems, homeTheory } from "./_home/systems";

/**
 * Papel cuadriculado de fondo del encabezado. Con `var(--border)` sale bien en
 * los dos temas sin tocar nada; la máscara lo apaga hacia los bordes para que
 * no compita con el texto.
 */
const gridPaper = {
  backgroundImage:
    "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
  backgroundSize: "2rem 2rem",
  maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%)",
} as const;

/** Las fórmulas son las mismas que muestra cada sistema (`f` libres, `r` restringidos). */
const steps = [
  {
    title: "Cada barra, su rigidez",
    text: "La matriz local de la barra, llevada a los ejes globales con la matriz de transformación.",
    tex: String.raw`K_e = T^{T} \cdot k \cdot T`,
  },
  {
    title: "Ensamblar",
    text: "Cada bloque se suma en los grados de libertad de sus nudos. La app muestra cada suma, una por una.",
    tex: String.raw`K = \sum_e K_e`,
  },
  {
    title: "Particionar",
    text: "Los grados de libertad libres por un lado y los restringidos por el otro.",
    tex: String.raw`\begin{bmatrix} F_f \\ F_r \end{bmatrix} = \begin{bmatrix} K_{ff} & K_{fr} \\ K_{rf} & K_{rr} \end{bmatrix} \begin{bmatrix} U_f \\ U_r \end{bmatrix}`,
  },
  {
    title: "Resolver",
    text: "Los desplazamientos que faltan, y con ellos las reacciones y las fuerzas en cada barra.",
    tex: String.raw`U_f = K_{ff}^{-1} \left( F_f - K_{fr}\, U_r \right)`,
  },
] as const;

const features = [
  {
    icon: ListOrdered,
    title: "El cálculo, paso a paso",
    text: "Ensamblaje, partición, solución, fuerzas internas y equilibrio, cada uno en su sección.",
  },
  {
    icon: Sigma,
    title: "Fórmulas en las celdas",
    text: "Las tablas aceptan expresiones: 3*sqrt(2), 2.1e7/100. El número que ves es el que escribiste.",
  },
  {
    icon: GraduationCap,
    title: "Modo práctica",
    text: "Calculá una matriz a mano y la app te marca qué casilla está bien y cuál no.",
  },
  {
    icon: FileSpreadsheet,
    title: "Excel con el método vivo",
    text: "El libro exportado tiene el método en fórmulas: cambiás un dato y Excel recalcula todo.",
  },
  {
    icon: MousePointerClick,
    title: "Tabla y dibujo, enlazados",
    text: "Pasá el mouse por una fila y se enciende en el esquema; por el esquema, y se enciende la fila.",
  },
  {
    icon: HardDrive,
    title: "Tu modelo se guarda",
    text: "Queda en el navegador. Con ejemplos precargados para empezar y «Deshacer» si te equivocás.",
  },
] as const;

/**
 * El verde como **texto**. `--primary` en oscuro está pensado como fondo de
 * botón y sobre `--background` da 2.78 de contraste (WCAG pide 4.5); el
 * `--sidebar-primary` del tema es el mismo verde más claro y da 8.93. En claro
 * `--primary` alcanza solo.
 */
const accentText = "text-primary dark:text-sidebar-primary";

/** Número de sección, con el estilo de los rótulos de un plano. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className={`text-xs font-semibold tracking-widest uppercase ${accentText}`}>{children}</p>;
}

export default function Home() {
  return (
    <main className="flex flex-col">
      {/* Encabezado */}
      <section className="relative overflow-hidden border-b">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={gridPaper} />
        <div className="relative mx-auto grid w-full max-w-5xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div className="flex flex-col items-start gap-6">
            <Eyebrow>{siteConfig.name} · método matricial de rigideces</Eyebrow>
            <h1 className="font-heading text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl">
              El análisis estructural, con todas las cuentas a la vista.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-pretty text-muted-foreground">
              Cargás nudos, barras y apoyos; la app arma la matriz de rigidez, la resuelve y te muestra cada paso como
              en el pizarrón: de resortes a pórticos con análisis sísmico según la norma peruana.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/springs">
                  Empezar por los resortes
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a href="#sistemas">Ver los sistemas</a>
              </Button>
            </div>
            <dl className="mt-4 grid w-full max-w-xl grid-cols-3 border-t pt-6">
              {[
                ["5", "sistemas"],
                ["1–3", "gdl por nudo"],
                ["E.030", "versión 2026"],
              ].map(([value, label]) => (
                <div key={label} className="flex flex-col gap-1">
                  <dt className="order-2 text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-heading text-2xl font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <figure className="mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative">
              {/* Marcas de corte, como en una lámina */}
              <span aria-hidden className="absolute -top-3 -left-3 size-6 border-t-2 border-l-2 border-primary" />
              <span aria-hidden className="absolute -right-3 -bottom-3 size-6 border-r-2 border-b-2 border-primary" />
              <Image
                src={heroImage}
                alt="Estructura de acero en montaje vista desde abajo al atardecer: columnas, vigas y arriostres"
                placeholder="blur"
                priority
                sizes="(min-width: 448px) 28rem, 100vw"
                className="aspect-4/5 w-full object-cover shadow-sm ring-1 ring-foreground/10"
              />
              <div className="absolute bottom-4 left-4 border bg-background/90 px-4 py-3 shadow-sm backdrop-blur">
                <p className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">La ecuación de todo</p>
                <Math tex={String.raw`F = K \cdot U`} className="text-xl" />
              </div>
            </div>
            <figcaption className="mt-5 text-xs text-muted-foreground">
              fig. 01 — estructura de acero en montaje
            </figcaption>
          </figure>
        </div>
      </section>

      {/* El método */}
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-20">
        <div className="flex max-w-2xl flex-col gap-3">
          <Eyebrow>01 · El método</Eyebrow>
          <h2 className="font-heading text-3xl font-bold tracking-tight">Cuatro pasos, siempre los mismos.</h2>
          <p className="leading-relaxed text-muted-foreground">
            Un resorte, una armadura espacial o un edificio de cinco pisos se resuelven igual. Lo que cambia es cuántos
            grados de libertad tiene cada nudo; la app hace las cuentas y no se saltea ninguna.
          </p>
        </div>
        <ol className="grid gap-px overflow-hidden border bg-border sm:grid-cols-2">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-3 bg-background p-6">
              <span className={`font-heading text-sm font-bold ${accentText}`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-heading text-lg font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              <MathBlock tex={step.tex} className="mt-auto border-t pt-4" />
            </li>
          ))}
        </ol>
      </section>

      {/* Los sistemas */}
      <section id="sistemas" className="scroll-mt-6 border-y bg-muted/40">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-20">
          <div className="flex max-w-2xl flex-col gap-3">
            <Eyebrow>02 · Los sistemas</Eyebrow>
            <h2 className="font-heading text-3xl font-bold tracking-tight">De un resorte a un edificio.</h2>
            <p className="leading-relaxed text-muted-foreground">
              Ordenados de menos a más: cada uno agrega una sola idea nueva sobre el anterior.
            </p>
          </div>

          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {homeSystems.map((system, i) => (
              <li key={system.href}>
                <Link
                  href={system.href}
                  className="group flex h-full flex-col overflow-hidden border bg-card text-card-foreground shadow-sm transition-colors outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <div className="relative aspect-3/2 overflow-hidden border-b">
                    <Image
                      src={system.image}
                      alt={system.alt}
                      placeholder="blur"
                      sizes="(min-width: 1024px) 20rem, (min-width: 640px) 50vw, 100vw"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className="absolute top-3 left-3 bg-background/90 px-2 py-1 font-heading text-xs font-bold backdrop-blur">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex flex-col gap-1">
                      <h3 className="font-heading text-lg font-semibold">{system.label}</h3>
                      <p className={`text-xs ${accentText}`}>{system.dof}</p>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{system.summary}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                      {/* No `Badge`: en este estilo es texto sin borde, y tres seguidos se leen como una frase. */}
                      {system.tags.map((tag) => (
                        <span
                          key={tag}
                          className="border px-2 py-0.5 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase"
                        >
                          {tag}
                        </span>
                      ))}
                      <ArrowRight
                        aria-hidden
                        className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary dark:group-hover:text-sidebar-primary"
                      />
                    </div>
                  </div>
                </Link>
              </li>
            ))}

            {/* La teoría no es un sistema: misma grilla, otra voz. */}
            <li>
              <Link
                href={homeTheory.href}
                className="group flex h-full flex-col overflow-hidden border border-dashed bg-background shadow-sm transition-colors outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <div className="relative aspect-3/2 overflow-hidden border-b border-dashed">
                  <Image
                    src={homeTheory.image}
                    alt={homeTheory.alt}
                    placeholder="blur"
                    sizes="(min-width: 1024px) 20rem, (min-width: 640px) 50vw, 100vw"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute top-3 left-3 bg-background/90 px-2 py-1 text-xs font-semibold tracking-widest uppercase backdrop-blur">
                    Teoría
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <h3 className="font-heading text-lg font-semibold">{homeTheory.label}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{homeTheory.summary}</p>
                  <span className={`mt-auto flex items-center gap-2 pt-2 text-xs font-semibold tracking-widest uppercase ${accentText}`}>
                    Leer
                    <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* Lo que tienen todos */}
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-20">
        <div className="flex max-w-2xl flex-col gap-3">
          <Eyebrow>03 · En todos los sistemas</Eyebrow>
          <h2 className="font-heading text-3xl font-bold tracking-tight">Hecho para aprender, no solo para calcular.</h2>
        </div>
        <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col gap-3">
              <span className={`flex size-10 items-center justify-center border bg-primary/10 ${accentText}`}>
                <Icon aria-hidden className="size-5" />
              </span>
              <h3 className="font-heading font-semibold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Cierre */}
      <section className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-6 px-6 py-14 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-2xl font-bold tracking-tight">¿Por dónde empezar?</h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Si es la primera vez, por los resortes: es el método sin nada alrededor. Si ya lo conocés, cada sistema
              trae ejemplos precargados: cargá uno y abrí el procedimiento.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/springs">Resortes</Link>
            </Button>
            <Button asChild>
              <Link href="/frame2d-seismic">
                Pórticos con sismo
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>{siteConfig.name} — análisis matricial de estructuras, paso a paso.</p>
          <p>Las fotos de esta página son ilustrativas, generadas con IA.</p>
        </div>
      </footer>
    </main>
  );
}

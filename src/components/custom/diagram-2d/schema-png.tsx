"use client";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { SchemaDiagram } from "./schema-diagram";
import type { DiagramElement, DiagramNode, DiagramSupport } from "./types";

export interface SchemaPng {
  /** PNG en base64, sin el prefijo `data:`. */
  base64: string;
  /** Tamaño en que se muestra (el PNG tiene el doble de píxeles, para que se vea nítido). */
  width: number;
  height: number;
}

interface SchemaPngInput {
  nodes: DiagramNode[];
  elements: DiagramElement[];
  supports: DiagramSupport[];
  /** Ancho en que se va a mostrar. El alto sale de la proporción de la figura. */
  width?: number;
}

/** Lo que el SVG toma de las clases de Tailwind y hay que pasar a la línea. */
const INLINED = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linejoin",
  "stroke-linecap",
  "paint-order",
  "opacity",
  "font-weight",
] as const;

/**
 * El esquema de un sistema plano como PNG, para ponerlo en un archivo (la
 * exportación a Excel). **Es el mismo `SchemaDiagram` de la pantalla**, no un
 * dibujo aparte: los apoyos, las etiquetas y la escala salen de un solo lado.
 *
 * Tres cosas no son obvias:
 *
 * - **Se dibuja en un iframe oculto.** El archivo va en una hoja blanca, así
 *   que el esquema tiene que salir en tema claro aunque la página esté en
 *   oscuro. El tema es la clase `.dark` del `<html>` y la variante `dark:` de
 *   Tailwind matchea a todo lo que esté adentro, así que en la misma página no
 *   hay forma de dibujar un subárbol claro. Un iframe sin esa clase, con las
 *   mismas hojas de estilo, sí — y la página no parpadea.
 * - **Los colores se pasan a la línea.** Un SVG convertido en imagen no ve las
 *   hojas de estilo de nadie: cada `fill-foreground` tiene que viajar como el
 *   color que resolvió. Chrome devuelve `oklch(...)` y lo dibuja bien dentro de
 *   la imagen (verificado en el spike del 2026-10-14).
 * - **La tipografía no viaja**: un SVG dentro de `<img>` no carga fuentes web,
 *   así que se pide directamente una monoespaciada del sistema, que es lo más
 *   parecido a la de la app. (Poner antes el nombre de la fuente web daba el
 *   mismo PNG byte a byte —no resuelve y cae en la siguiente—; se saca porque
 *   no aporta nada.)
 */
export async function schemaPng({ nodes, elements, supports, width = 420 }: SchemaPngInput): Promise<SchemaPng> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  // Fuera de la vista pero con tamaño real: con `display: none` no hay estilos
  // computados que leer.
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:800px;height:800px;border:0;";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument!;
    // Las mismas reglas de estilo que la página, **copiadas como texto** y no
    // como `<link>`: Next las enlaza con rutas relativas (`/_next/...`) y dentro
    // de un iframe `about:blank` esas rutas no resuelven contra el sitio. Así
    // salió la primera versión: sin una sola regla, con las barras invisibles y
    // todo en negro — y los números del libro bien, porque eso no lo mira nadie
    // más que una captura.
    const css = [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText)).join("\n");
    const style = doc.createElement("style");
    style.textContent = css;
    doc.head.appendChild(style);
    // Y las mismas clases del `<html>` (son las que declaran las fuentes)
    // **menos `dark`**.
    doc.documentElement.className = document.documentElement.className.replace(/\bdark\b/g, "");
    doc.body.className = document.body.className;

    const host = doc.createElement("div");
    doc.body.appendChild(host);
    const root = createRoot(host);
    flushSync(() =>
      root.render(
        <SchemaDiagram nodes={nodes} elements={elements} supports={supports} forces={[]} className="h-[600px] w-[600px]" />,
      ),
    );

    try {
      const svg = host.querySelector("svg")!;
      const view = iframe.contentWindow!;
      const clone = svg.cloneNode(true) as SVGSVGElement;

      const originals = [svg, ...svg.querySelectorAll("*")];
      const copies = [clone, ...clone.querySelectorAll("*")];
      originals.forEach((original, i) => {
        const computed = view.getComputedStyle(original);
        const target = copies[i] as SVGElement;
        target.removeAttribute("class");
        for (const property of INLINED) target.style.setProperty(property, computed.getPropertyValue(property));
        // Por nombre y no con `instanceof`: los elementos son del iframe, y
        // `SVGTextElement` de esta ventana no es el mismo constructor.
        if (original.tagName === "text") target.style.setProperty("font-family", "Consolas, ui-monospace, monospace");
      });

      // Fondo blanco explícito: sin él, el PNG es transparente y Excel lo
      // muestra sobre la grilla.
      const [x, y, w, h] = svg.getAttribute("viewBox")!.split(/\s+/).map(Number);
      const background = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
      Object.entries({ x, y, width: w, height: h, fill: "white" }).forEach(([k, v]) =>
        background.setAttribute(k, String(v)),
      );
      clone.insertBefore(background, clone.firstChild);

      const height = Math.round((width * h) / w);
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
      await image.decode();

      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const context = canvas.getContext("2d")!;
      context.scale(scale, scale);
      context.drawImage(image, 0, 0, width, height);

      return { base64: canvas.toDataURL("image/png").split(",")[1], width, height };
    } finally {
      root.unmount();
    }
  } finally {
    iframe.remove();
  }
}

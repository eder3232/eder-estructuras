// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

/**
 * El primer test de componente del repo, y no por casualidad: el toggle se
 * montó sin que **ningún click se hubiera ejercitado nunca** acá adentro. La
 * verificación visual que se venía haciendo es headless y no interactúa, así que
 * lo único comprobado hasta hoy era que la página rinde bien en cada tema
 * forzándolo desde el layout — que es otra cosa.
 */

afterEach(() => {
  cleanup();
  // El tema vive en <html> y en localStorage, o sea fuera de lo que `cleanup`
  // desmonta. Sin esto el segundo test arranca con lo que dejó el primero.
  document.documentElement.className = "";
  localStorage.clear();
});

/** Mismas props que el `layout.tsx` real: si allá cambian, acá tiene que fallar. */
function renderToggle() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle", () => {
  it("escribe la clase `dark` en <html> al hacer click, y la saca al siguiente", async () => {
    const user = userEvent.setup();
    renderToggle();
    const button = screen.getByRole("button", { name: "Cambiar entre modo claro y oscuro" });

    // Arranca en `system`, y headless resuelve `prefers-color-scheme` en claro.
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await user.click(button);
    // La clase, no el estado interno de next-themes: es lo que consume el
    // `@custom-variant dark (&:is(.dark *))` de `globals.css`, o sea lo que
    // efectivamente hace que el modo oscuro se vea.
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await user.click(button);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("deja los dos iconos en el DOM y deja que `dark:` elija cuál se ve", () => {
    const { container } = renderToggle();
    const icons = [...container.querySelectorAll("svg")].map((svg) => svg.getAttribute("class"));

    // Es la decisión documentada en el componente: sin `useState` + `useEffect`
    // de "mounted" (que dispararía `react-hooks/set-state-in-effect`, el tercer
    // error de lint que rompería el criterio de "2 preexistentes"), el markup
    // tiene que ser idéntico en servidor y cliente. Si alguien vuelve al patrón
    // habitual, acá va a quedar un solo icono.
    expect(icons).toHaveLength(2);
    expect(icons.some((c) => c?.includes("dark:hidden"))).toBe(true);
    expect(icons.some((c) => c?.includes("dark:block"))).toBe(true);
  });
});

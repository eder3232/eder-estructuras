// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "jotai";

import { HighlightProvider } from "@/components/custom/highlight";
import { ResultsPanel } from "./results-panel";

/**
 * El paso 4 de docs/armaduras-3d-v1.md: la narrativa de `/armaduras-2d` en 3D,
 * y el modo práctica con su ejercicio propio (un bloque de 3×3).
 */

afterEach(cleanup);

function setup() {
  render(
    <Provider>
      <HighlightProvider>
        <ResultsPanel />
      </HighlightProvider>
    </Provider>,
  );
  return userEvent.setup();
}

async function openEverything(user: ReturnType<typeof userEvent.setup>) {
  for (const trigger of screen.getAllByRole("button", { expanded: false })) {
    if (trigger.getAttribute("data-slot") === "accordion-trigger") await user.click(trigger);
  }
}

describe("/armaduras-3d — panel de resultados", () => {
  it("cada barra tiene su cadena con «Ver apilada», y las ecuaciones grandes su pantalla completa", async () => {
    const user = setup();
    await openEverything(user);

    // Las seis barras del tetraedro.
    expect(screen.getAllByRole("button", { name: /Ver apilada/ })).toHaveLength(6);
    // F = K·U, y las dos ecuaciones de la partición.
    expect(screen.getAllByRole("button", { name: /Pantalla completa/ })).toHaveLength(3);
    expect(screen.getByRole("switch", { name: /como mapa/ })).toBeTruthy();
    // Abre todo el panel de una armadura de 6 barras en happy-dom: solo tarda
    // ~2 s, pero con la suite entera en paralelo pasaba de los 5 s por defecto
    // y fallaba de vez en cuando (visto el 2026-10-17, dos veces).
  }, 20000);

  it("el modo práctica pide las 36 posiciones de una barra", async () => {
    const user = setup();
    await user.click(screen.getByRole("switch", { name: "Modo práctica" }));

    // e1 va de a a b: sus seis grados de libertad, todos contra todos.
    const dofs = ["ax", "ay", "az", "bx", "by", "bz"];
    for (const row of dofs) for (const col of dofs) await user.click(screen.getByRole("button", { name: `${row} con ${col}` }));
    await user.click(screen.getAllByRole("button", { name: "Verificar" })[0]);

    expect(screen.getByText("Las 36 posiciones, bien.")).toBeTruthy();
  });

  it("y después el bloque de 3×3 del nudo de origen, corregido contra el motor", async () => {
    const user = setup();
    await user.click(screen.getByRole("switch", { name: "Modo práctica" }));

    // e1 va de a (0,0,0) a b (3.5,0,0): solo Cx = 1, así que del bloque solo
    // la celda x·x vale algo, EA/L = 2e7·0.002/3.5.
    // El rótulo es el mismo que el de las celdas del ejercicio de posiciones: se buscan los campos.
    const input = (name: string) => screen.getAllByLabelText(name).find((e) => e.tagName === "INPUT")!;
    expect(document.querySelectorAll("input[aria-label]")).toHaveLength(9);
    for (const row of ["ax", "ay", "az"])
      for (const col of ["ax", "ay", "az"])
        await user.type(input(`${row} con ${col}`), row === "ax" && col === "ax" ? "2e7*0.002/3.5" : "0");
    await user.click(screen.getAllByRole("button", { name: "Verificar" })[1]);

    expect(screen.getByText("Las 9 celdas, bien.")).toBeTruthy();
  });
});

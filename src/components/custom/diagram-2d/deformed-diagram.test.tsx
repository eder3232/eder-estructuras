// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "jotai";

import { DeformedDiagram } from "./deformed-diagram";

/**
 * La animación no se puede mirar en una captura —headless saca cuadros
 * quietos—, así que lo único que puede decir si funciona es un test.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const nodes = [
  { id: "v1", name: "v1", x: 0, z: 0 },
  { id: "v2", name: "v2", x: 3, z: 0 },
];
const elements = [{ id: "e1", name: "e1", fromNodeId: "v1", toNodeId: "v2" }];

function renderDiagram() {
  return render(
    <Provider>
      <DeformedDiagram
        nodes={nodes}
        elements={elements}
        displacements={new Map([["v2", [0.01, 0]]])}
        reactions={[]}
        elementForceValue={new Map([["e1", 5]])}
        scale={{ initial: 20, max: 100, step: 5 }}
      />
    </Provider>,
  );
}

const factorMostrado = () => screen.getByText(/^Factor de escala:/).textContent;

describe("DeformedDiagram · animación", () => {
  it("arranca en cero y vuelve al mismo factor: lo que cambia es el camino", async () => {
    // Se toma el control de los cuadros en vez de esperar a que corran solos:
    // si no, el test pasaría aunque la animación no hiciera nada, porque empieza
    // y termina en el mismo valor.
    const cuadros: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => cuadros.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const user = userEvent.setup();
    renderDiagram();
    expect(factorMostrado()).toBe("Factor de escala: 20");

    await user.click(screen.getByRole("button", { name: "Animar la deformación desde cero" }));

    expect(factorMostrado()).toBe("Factor de escala: 0");
    expect(cuadros).toHaveLength(1);

    // Un cuadro más allá del final de la animación.
    await act(async () => cuadros[0](performance.now() + 10_000));

    expect(factorMostrado()).toBe("Factor de escala: 20");
  });

  it("no deja cuadros pendientes cuando termina", async () => {
    const cuadros: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => cuadros.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const user = userEvent.setup();
    renderDiagram();
    await user.click(screen.getByRole("button", { name: "Animar la deformación desde cero" }));

    await act(async () => cuadros[0](performance.now() + 10_000));

    // El último cuadro no pide otro: si lo pidiera, la animación quedaría
    // corriendo para siempre contra el mismo valor.
    expect(cuadros).toHaveLength(1);
  });

  it("con «menos movimiento» activado salta al final en vez de animar", async () => {
    // Es una preferencia del sistema operativo, no un adorno: quien la puso
    // pidió que las cosas no se muevan solas.
    vi.stubGlobal("matchMedia", () => ({ matches: true, media: "", addEventListener() {}, removeEventListener() {} }));
    const user = userEvent.setup();
    renderDiagram();

    await user.click(screen.getByRole("button", { name: "Animar la deformación desde cero" }));

    // Sin ningún cuadro intermedio: el valor ya está puesto.
    expect(factorMostrado()).toBe("Factor de escala: 20");
  });
});

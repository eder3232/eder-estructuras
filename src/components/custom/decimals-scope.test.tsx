// @vitest-environment happy-dom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "jotai";

import { DecimalsScope, ScopeDecimalsControl, ScopeDecimalsStepper } from "./decimals-scope";

/**
 * La cascada página → bloque → tabla se había verificado mirando la app, que es
 * lo que encontró sus dos problemas de UX, pero **ningún click**: las capturas
 * son estáticas. Acá se ejercita lo que la captura no puede mostrar — que subir
 * un decimal en una tabla no arrastre a la de al lado, y que una tabla en
 * automático siga a su sección incluso después de fijarla y soltarla.
 *
 * Cada `render` va dentro de un `<Provider>` propio de Jotai: los átomos de
 * `decimals.ts` son de módulo, así que sin store propio el override de un test
 * se filtra al siguiente.
 */

afterEach(cleanup);

function renderScopes(ui: ReactNode) {
  return render(<Provider>{ui}</Provider>);
}

/** Envoltorio con `data-testid` para poder distinguir dos steppers hermanos. */
function Table({ id }: { id: string }) {
  return (
    <DecimalsScope id={id}>
      <div data-testid={id}>
        <ScopeDecimalsStepper />
      </div>
    </DecimalsScope>
  );
}

const stepper = (testId: string) => within(screen.getByTestId(testId));

/** Lo que muestra el `− n +`. Los botones son solo iconos, así que el único texto es el número. */
const shown = (testId: string) => stepper(testId).getByText(/^\d$/).textContent;

const isDisabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;

const mas = (testId: string) => stepper(testId).getByRole("button", { name: "Un decimal más en esta tabla" });
const menos = (testId: string) => stepper(testId).getByRole("button", { name: "Un decimal menos en esta tabla" });

describe("ScopeDecimalsStepper", () => {
  it("sube y baja de a un decimal desde el valor de la página", async () => {
    const user = userEvent.setup();
    renderScopes(<Table id="k" />);

    expect(shown("k")).toBe("4");

    await user.click(mas("k"));
    expect(shown("k")).toBe("5");

    await user.click(menos("k"));
    await user.click(menos("k"));
    expect(shown("k")).toBe("3");
  });

  it("no pasa de 0 ni de 8", async () => {
    const user = userEvent.setup();
    renderScopes(<Table id="k" />);

    for (let i = 0; i < 4; i++) await user.click(menos("k"));
    expect(shown("k")).toBe("0");
    expect(isDisabled(menos("k"))).toBe(true);

    for (let i = 0; i < 8; i++) await user.click(mas("k"));
    expect(shown("k")).toBe("8");
    expect(isDisabled(mas("k"))).toBe(true);
  });

  it("no arrastra a la tabla de al lado", async () => {
    const user = userEvent.setup();
    renderScopes(
      <DecimalsScope id="bloque">
        <Table id="kff" />
        <Table id="krr" />
      </DecimalsScope>,
    );

    await user.click(mas("kff"));

    expect(shown("kff")).toBe("5");
    expect(shown("krr")).toBe("4");
  });

  it("la tabla en automático sigue a su sección; la fijada se independiza y el ↺ la suelta", async () => {
    const user = userEvent.setup();
    renderScopes(
      <DecimalsScope id="bloque">
        <div data-testid="bloque">
          <ScopeDecimalsStepper />
        </div>
        <Table id="auto" />
        <Table id="fija" />
      </DecimalsScope>,
    );

    // Una tabla se pincha en 6; la otra queda en automático.
    await user.click(mas("fija"));
    await user.click(mas("fija"));

    await user.click(menos("bloque"));

    expect(shown("bloque")).toBe("3");
    expect(shown("auto")).toBe("3");
    expect(shown("fija")).toBe("6");

    // El ↺ solo existe en la que tiene valor propio: es lo que hace visible que
    // esa tabla dejó de seguir a la sección.
    expect(stepper("auto").queryByRole("button", { name: "Volver a seguir a la sección" })).toBeNull();
    await user.click(stepper("fija").getByRole("button", { name: "Volver a seguir a la sección" }));
    expect(shown("fija")).toBe("3");
  });
});

describe("ScopeDecimalsControl", () => {
  it("fija la sección desde el desplegable, y el trigger pasa de «Auto» a «Fijo»", async () => {
    const user = userEvent.setup();
    renderScopes(
      <DecimalsScope id="bloque">
        <ScopeDecimalsControl label="Decimales de la sección" />
        <Table id="auto" />
      </DecimalsScope>,
    );

    const trigger = () => screen.getByRole("combobox");
    expect(trigger().textContent).toContain("Auto (4)");

    await user.click(trigger());
    await user.click(await screen.findByRole("option", { name: "2" }));

    // El estado `Fijo (n)` del trigger es justo lo que la verificación visual
    // no había podido mirar: para verlo en una captura hay que sembrar el átomo
    // a mano, porque headless no abre un desplegable.
    expect(trigger().textContent).toContain("Fijo (2)");
    expect(shown("auto")).toBe("2");
  });


  it("«Restablecer» arranca deshabilitado y devuelve a automático la sección y sus tablas", async () => {
    const user = userEvent.setup();
    renderScopes(
      <DecimalsScope id="bloque">
        <ScopeDecimalsControl label="Decimales de la sección" />
        <Table id="fija" />
      </DecimalsScope>,
    );

    const restablecer = () => screen.getByRole("button", { name: /Restablecer/ });
    expect(isDisabled(restablecer())).toBe(true);

    // Un override en una tabla ya habilita el botón de la sección: es
    // justamente el caso que motivó el reset en cascada — una tabla fijada
    // fuera de pantalla, imposible de soltar desde donde está.
    await user.click(mas("fija"));
    expect(isDisabled(restablecer())).toBe(false);

    await user.click(restablecer());
    expect(shown("fija")).toBe("4");
    expect(isDisabled(restablecer())).toBe(true);
  });
});

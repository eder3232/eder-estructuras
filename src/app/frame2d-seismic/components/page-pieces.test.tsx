// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "jotai";

import { HighlightProvider } from "@/components/custom/highlight";
import { LoadTable } from "@/app/frame2d/components/load-table";
import { NodeTable } from "@/app/frame2d/components/node-table";
import { createSeismicStore } from "../store/persistence";
import { CaseSchema } from "./case-schema";
import { GRAVITY_CASES } from "./cases";
import { LevelsTable } from "./levels-table";
import { SeismicSteps } from "./seismic-params";

/** Lo que se miró en la app en el paso 5 de `docs/frame2d-seismic-v1.md`. */
afterEach(cleanup);

function renderWithStore(children: React.ReactNode) {
  return render(
    <Provider store={createSeismicStore(null)}>
      <HighlightProvider>{children}</HighlightProvider>
    </Provider>,
  );
}

const svgNumbers = (container: HTMLElement) =>
  [...container.querySelectorAll("svg text")].map((t) => t.textContent ?? "").filter((t) => /^-?\d+\.\d+$/.test(t));

describe("la página sísmica", () => {
  it("el esquema es de un caso: la muerta y la viva de una viga no se pisan, y CS dibuja las Fᵢ", async () => {
    const user = userEvent.setup();
    const { container } = renderWithStore(<CaseSchema />);
    expect(svgNumbers(container)).toEqual(["-3.0000", "-2.5000"]);

    await user.click(screen.getByRole("button", { name: /CV · Carga viva/ }));
    expect(svgNumbers(container)).toEqual(["-1.2000", "-0.6000"]);

    await user.click(screen.getByRole("button", { name: /CS · Sismo/ }));
    expect(svgNumbers(container)).toEqual(["3.4558", "4.2786"]);
  });

  it("la tabla de nudos queda en geometría y apoyos; la de cargas suma la columna del caso", () => {
    renderWithStore(
      <>
        <NodeTable withLoads={false} />
        <LoadTable cases={GRAVITY_CASES} />
      </>,
    );
    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent);
    expect(headers).not.toContain("Fuerza");
    expect(headers).not.toContain("Desplazamiento");
    expect(headers).toContain("Caso");
    expect(screen.getByRole("combobox", { name: "Caso de la carga c3" }).textContent).toContain("CV");
  });

  it("los niveles y el cortante salen con los números del ejemplo", () => {
    const { container } = renderWithStore(
      <>
        <LevelsTable />
        <SeismicSteps />
      </>,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("v3, v4");
    expect(text).toContain("3.4558");
    expect(text).toContain("7.7344");
    expect(container.querySelectorAll(".katex-error")).toHaveLength(0);
  });
});

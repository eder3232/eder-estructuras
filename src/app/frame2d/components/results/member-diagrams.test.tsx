// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore } from "jotai";

import { examples } from "../../store/examples";
import { atomElements } from "../../store/elements";
import { atomNodes } from "../../store/nodes";
import { atomRestoreModel } from "../../store/persistence";
import { MemberDiagrams } from "./member-diagrams";

/**
 * Los números del diagrama de momentos sobre el pórtico: los que un libro
 * escribiría, y sin signo (el lado traccionado ya lo dice).
 */

afterEach(cleanup);

function renderExample(id: string) {
  const store = createStore();
  store.set(atomRestoreModel, examples.find((e) => e.id === id)!.model);
  const nodesById = new Map(store.get(atomNodes).map((n) => [n.id, n]));
  render(
    <Provider store={store}>
      <MemberDiagrams elements={store.get(atomElements)} nodesById={nodesById} />
    </Provider>,
  );
}

const frameLabels = () => {
  const svg = screen.getByRole("group", { name: "Qué esfuerzo dibujar" }).parentElement!.querySelector("svg")!;
  return [...svg.querySelectorAll("text")].map((t) => t.textContent);
};

describe("diagrama de momentos sobre el pórtico", () => {
  it("escribe el momento bajo una carga puntual, aunque ahí M no salte", () => {
    // En el pórtico isostático el máximo está bajo la carga de 20 de la viga:
    // 24 + 9.333·2 = 42.67. V salta por encima del cero, así que no es un
    // «extremo» de V = 0, y antes no se rotulaba.
    renderExample("isostatico");
    expect(frameLabels()).toContain("42.6667");
  });

  it("sin signo: en un pórtico simétrico, las dos bases dicen lo mismo", () => {
    renderExample("dos-aguas");
    const labels = frameLabels();
    expect(labels.filter((l) => l === "29.9322")).toHaveLength(2);
    expect(labels.some((l) => l?.startsWith("-"))).toBe(false);
  });

  it("el corte sí lleva signo", async () => {
    const user = userEvent.setup();
    renderExample("viga-continua");
    await user.click(screen.getByRole("button", { name: "Fuerza cortante (V)" }));
    expect(frameLabels()).toEqual(expect.arrayContaining(["18.7500", "-31.2500", "31.2500", "-18.7500"]));
  });
});

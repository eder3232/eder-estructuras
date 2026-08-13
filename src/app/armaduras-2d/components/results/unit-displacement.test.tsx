// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "jotai";

import { System, TrussElement2D } from "@/lib/engine";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";
import { UnitDisplacement } from "./unit-displacement";

/**
 * Lo que este bloque afirma en pantalla es fuerte: *las flechas **son** la
 * columna de K*. Si el cableado se rompe, la afirmación queda igual de segura y
 * los números dejan de corresponder — o sea que es exactamente el tipo de cosa
 * que hay que fijar con un test y no con una captura.
 */

afterEach(cleanup);

const nodes: NodeRow[] = [
  { id: "v1", name: "v1", x: 0, z: 0, forceX: 0, forceZ: 0, displacementX: 0, displacementZ: 0, restrainedX: true, restrainedZ: true },
  { id: "v2", name: "v2", x: 3, z: 0, forceX: 0, forceZ: 0, displacementX: 0, displacementZ: 0, restrainedX: true, restrainedZ: true },
  { id: "v3", name: "v3", x: 0, z: 4, forceX: 0, forceZ: -10, displacementX: 0, displacementZ: 0, restrainedX: false, restrainedZ: false },
];

const elements: ElementRow[] = [
  { id: "e1", name: "e1", fromNodeId: "v1", toNodeId: "v3", area: 0.001, elasticity: 2e7 },
  { id: "e2", name: "e2", fromNodeId: "v2", toNodeId: "v3", area: 0.001, elasticity: 2e7 },
];

function assemble() {
  const system = new System(2);
  for (const node of nodes) {
    system.addNode({
      id: node.id,
      restrained: [node.restrainedX, node.restrainedZ],
      force: [node.forceX, node.forceZ],
    });
  }
  for (const element of elements) {
    const from = nodes.find((n) => n.id === element.fromNodeId)!;
    const to = nodes.find((n) => n.id === element.toNodeId)!;
    system.addElement(
      new TrussElement2D(
        element.id,
        { id: from.id, x: from.x, z: from.z },
        { id: to.id, x: to.x, z: to.z },
        element.area,
        element.elasticity,
      ),
    );
  }
  return system.solve().assembly;
}

function renderBlock() {
  const assembly = assemble();
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  render(
    <Provider>
      <UnitDisplacement elements={elements} nodesById={nodesById} assembly={assembly} />
    </Provider>,
  );
  return assembly;
}

/** Los valores de la columna tal como los escribe la tabla, sin el factor. */
function columnaEnPantalla() {
  const tabla = screen.getByRole("table");
  return [...tabla.querySelectorAll("tbody td")].map((td) => td.textContent);
}

describe("UnitDisplacement", () => {
  it("arranca en un grado de libertad libre, no en un apoyo", () => {
    renderBlock();

    // Empezar por un apoyo mostraría la estructura moviéndose desde donde está
    // sujeta, que es el caso menos intuitivo de los dos.
    expect(screen.getByRole("combobox").textContent).toBe("v3x");
  });

  it("la columna que muestra es la columna de K de ese grado de libertad", () => {
    const assembly = renderBlock();
    const v3x = assembly.dofOrder.find((e) => e.nodeId === "v3" && e.localDof === 0)!;

    const esperado = assembly.dofOrder.map((entry) =>
      // La tabla aplica notación compacta: la matriz entera va ×10³.
      (assembly.globalStiffness[entry.globalIndex][v3x.globalIndex] / 1000).toFixed(4),
    );

    expect(columnaEnPantalla()).toEqual(esperado);
  });

  it("cambiar de grado de libertad cambia la columna", async () => {
    const user = userEvent.setup();
    const assembly = renderBlock();
    const antes = columnaEnPantalla();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /^v3z/ }));

    const v3z = assembly.dofOrder.find((e) => e.nodeId === "v3" && e.localDof === 1)!;
    const esperado = assembly.dofOrder.map((entry) =>
      (assembly.globalStiffness[entry.globalIndex][v3z.globalIndex] / 1000).toFixed(4),
    );

    expect(columnaEnPantalla()).not.toEqual(antes);
    expect(columnaEnPantalla()).toEqual(esperado);
  });

  it("marca cuáles grados de libertad son apoyos, para que se pueda elegir uno a propósito", async () => {
    const user = userEvent.setup();
    renderBlock();

    await user.click(screen.getByRole("combobox"));
    const opciones = await screen.findAllByRole("option");
    const apoyos = opciones.filter((o) => o.textContent?.includes("(apoyo)")).map((o) => o.textContent);

    expect(apoyos).toEqual(["v1x (apoyo)", "v1z (apoyo)", "v2x (apoyo)", "v2z (apoyo)"]);
  });

  it("dibuja una flecha por cada fuerza distinta de cero de esa columna", () => {
    const assembly = renderBlock();
    const v3x = assembly.dofOrder.find((e) => e.nodeId === "v3" && e.localDof === 0)!;
    const noNulas = assembly.dofOrder.filter(
      (e) => assembly.globalStiffness[e.globalIndex][v3x.globalIndex] !== 0,
    ).length;

    // Se busca por el `viewBox`, que en el diagrama es calculado, y no por la
    // estructura del DOM: los iconos de lucide también son `svg` (con el suyo
    // en `0 0 24 24`), así que agregar un botón al bloque rompía el selector.
    const svg = [...document.querySelectorAll("svg")].find((s) => s.getAttribute("viewBox") !== "0 0 24 24");
    const flechas = [...(svg?.querySelectorAll("polygon") ?? [])];

    expect(flechas).toHaveLength(noNulas);
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Provider, atom, createStore } from "jotai";

import { HighlightProvider } from "@/components/custom/highlight";
import { ErrorsPanel } from "./components/errors-panel";
import { SchemaDiagram } from "./components/schema-diagram";
import { Frame2DViewProvider, frame2DModelView } from "./frame2d-view";
import { atomElements, atomRemoveElement } from "./store/elements";
import { atomNodes } from "./store/nodes";
import { frame2DMemberLoads, solveFrame2D } from "./store/results";

/**
 * Las dos piezas en las que se apoya `frame2d-seismic` para reusar `/frame2d`
 * sin copiarlo (`docs/frame2d-seismic-v1.md`, paso 3).
 */
afterEach(cleanup);

describe("un store de Jotai por página", () => {
  it("dos stores no comparten el modelo: editar uno no toca el otro", () => {
    const frame2d = createStore();
    const seismic = createStore();
    const e1 = seismic.get(atomElements)[0];

    seismic.set(atomRemoveElement, e1.id);

    expect(seismic.get(atomElements)).toHaveLength(2);
    expect(frame2d.get(atomElements)).toHaveLength(3);
  });
});

describe("Frame2DViewProvider", () => {
  const schemaBars = () => screen.queryAllByLabelText(/^Barra /).map((el) => el.getAttribute("aria-label"));

  it("sin proveedor, los componentes muestran el modelo del store", () => {
    render(
      <Provider>
        <HighlightProvider>
          <SchemaDiagram />
        </HighlightProvider>
      </Provider>,
    );
    expect(schemaBars()).toEqual(["Barra e1", "Barra e2", "Barra e3"]);
  });

  it("con proveedor, muestran el pórtico que reciben", () => {
    const view = {
      ...frame2DModelView,
      atomElements: atom((get) => get(atomElements).slice(0, 1)),
    };
    render(
      <Provider>
        <HighlightProvider>
          <Frame2DViewProvider value={view}>
            <SchemaDiagram />
          </Frame2DViewProvider>
        </HighlightProvider>
      </Provider>,
    );
    expect(schemaBars()).toEqual(["Barra e1"]);
  });

  it("los resultados también: un caso con un diafragma inválido muestra su error, no el del modelo", () => {
    const view = {
      ...frame2DModelView,
      atomResults: atom((get) => {
        const nodes = get(atomNodes);
        const elements = get(atomElements);
        return solveFrame2D({
          nodes,
          elements,
          memberLoads: frame2DMemberLoads(nodes, elements, []),
          restrainedFirst: false,
          useDofNumbers: false,
          // v1 está empotrado: no puede entrar a un diafragma.
          diaphragms: [{ id: "piso", nodeIds: [nodes[0].id, nodes[1].id] }],
        });
      }),
    };
    render(
      <Provider>
        <Frame2DViewProvider value={view}>
          <ErrorsPanel />
        </Frame2DViewProvider>
      </Provider>,
    );
    expect(screen.getByText(/no puede estar en el diafragma piso/)).toBeTruthy();
  });
});

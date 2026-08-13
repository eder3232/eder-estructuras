import { describe, expect, it } from "vitest";

import { SingularStiffnessError, loadCompatibility, nullMode, nullSpace, zeroStiffnessRows } from "./mechanism";
import { System } from "./system";
import { TrussElement2D } from "./trusses-2d/truss-element-2d";

describe("zeroStiffnessRows", () => {
  it("encuentra el grado de libertad al que no se opone nada", () => {
    const kff = [
      [100, 0, 0],
      [0, 0, 0],
      [0, 0, 100],
    ];

    expect(zeroStiffnessRows(kff)).toEqual([1]);
  });

  it("la tolerancia es relativa: un 10⁻⁶ al lado de rigideces de 10⁷ es cero", () => {
    const kff = [
      [2e7, 0],
      [0, 1e-6],
    ];

    expect(zeroStiffnessRows(kff)).toEqual([1]);
  });

  it("no marca nada en una matriz sana", () => {
    expect(zeroStiffnessRows([[10, -2], [-2, 10]])).toEqual([]);
  });
});

describe("nullMode", () => {
  it("devuelve el movimiento que no cuesta energía", () => {
    // Dos resortes en serie con el del medio suelto: el grado de libertad 1
    // puede moverse solo, y ese es el modo.
    const kff = [
      [100, 0],
      [0, 0],
    ];

    const mode = nullMode(kff);

    expect(mode).not.toBeNull();
    // Normalizado por la mayor componente, así se puede dibujar tal cual.
    expect(Math.max(...mode!.map(Math.abs))).toBeCloseTo(1, 10);
    expect(Math.abs(mode![1])).toBeCloseTo(1, 10);
    expect(Math.abs(mode![0])).toBeCloseTo(0, 10);
  });

  it("no inventa un modo cuando la estructura está bien sujeta", () => {
    expect(nullMode([[10, -2], [-2, 10]])).toBeNull();
  });

  it("no explota con una matriz vacía", () => {
    expect(nullMode([])).toBeNull();
  });
});

describe("System.solve con una estructura que es un mecanismo", () => {
  /** Un nudo libre al que solo llega una barra **vertical**: en x no lo sostiene nadie. */
  function conNudoSuelto() {
    const system = new System(2);
    system.addNode({ id: "v1", restrained: [true, true] });
    system.addNode({ id: "v2", restrained: [false, false], force: [5, -10] });
    system.addElement(
      new TrussElement2D("e1", { id: "v1", x: 0, z: 0 }, { id: "v2", x: 0, z: 4 }, 0.001, 2e7),
    );
    return system;
  }

  it("tira un error propio y no el de mathjs", () => {
    expect(() => conNudoSuelto().solve()).toThrow(SingularStiffnessError);
    // El mensaje es el que va a leer un alumno, no "Cannot calculate inverse".
    expect(() => conNudoSuelto().solve()).toThrow(/mecanismo/);
  });

  it("nombra el nudo y el eje que quedaron sueltos", () => {
    try {
      conNudoSuelto().solve();
      expect.unreachable("tendría que haber tirado");
    } catch (error) {
      const { diagnosis } = error as SingularStiffnessError;
      // Solo llega una barra vertical: la rigidez horizontal de v2 es cero.
      expect(diagnosis.loose).toEqual([{ nodeId: "v2", localDof: 0 }]);
    }
  });

  it("dice cómo se mueve, para poder dibujarlo", () => {
    try {
      conNudoSuelto().solve();
      expect.unreachable("tendría que haber tirado");
    } catch (error) {
      const { diagnosis } = error as SingularStiffnessError;
      expect(diagnosis.mode).not.toBeNull();

      const enX = diagnosis.mode!.find((d) => d.nodeId === "v2" && d.localDof === 0)!;
      const enZ = diagnosis.mode!.find((d) => d.nodeId === "v2" && d.localDof === 1)!;
      // El movimiento libre es horizontal: la barra vertical no se opone.
      expect(Math.abs(enX.value)).toBeCloseTo(1, 6);
      expect(Math.abs(enZ.value)).toBeCloseTo(0, 6);
    }
  });

  it("atrapa el mecanismo que se colaba: sin ninguna fila nula y con `inv` que no falla", () => {
    // Armadura cuadrada con diagonales y **ningún apoyo horizontal**: puede
    // trasladarse entera en x sin deformarse. Ninguna fila de `Kff` es nula
    // —todos los nudos tienen barras— y el determinante da ~10⁻¹⁰ en vez de 0,
    // así que `inv` de mathjs devuelve una "inversa" sin quejarse y el sistema
    // se resolvía con números sin sentido, en silencio. Lo encontró una captura.
    const system = new System(2);
    const puntos = { v1: [0, 0], v2: [3, 0], v3: [0, 4], v4: [3, 4] } as const;
    system.addNode({ id: "v1", restrained: [false, true] });
    system.addNode({ id: "v2", restrained: [false, true] });
    system.addNode({ id: "v3", restrained: [false, false], force: [0, -10] });
    system.addNode({ id: "v4", restrained: [false, false], force: [0, -10] });
    const barras: [string, keyof typeof puntos, keyof typeof puntos][] = [
      ["e1", "v1", "v2"],
      ["e2", "v3", "v4"],
      ["e3", "v1", "v3"],
      ["e4", "v2", "v4"],
      ["e5", "v1", "v4"],
      ["e6", "v2", "v3"],
    ];
    for (const [id, from, to] of barras) {
      system.addElement(
        new TrussElement2D(
          id,
          { id: from, x: puntos[from][0], z: puntos[from][1] },
          { id: to, x: puntos[to][0], z: puntos[to][1] },
          0.001,
          2e7,
        ),
      );
    }

    expect(() => system.solve()).toThrow(SingularStiffnessError);

    try {
      system.solve();
    } catch (error) {
      const { diagnosis } = error as SingularStiffnessError;
      expect(diagnosis.loose).toEqual([]);
      // El modo es la traslación horizontal: todos los nudos se mueven lo mismo
      // en x y nada en z.
      const enX = diagnosis.mode!.filter((d) => d.localDof === 0).map((d) => d.value);
      const enZ = diagnosis.mode!.filter((d) => d.localDof === 1).map((d) => d.value);
      expect(new Set(enX.map((v) => v.toFixed(6))).size).toBe(1);
      for (const value of enZ) expect(Math.abs(value)).toBeCloseTo(0, 6);
    }
  });

  it("una estructura bien apoyada se resuelve sin diagnóstico", () => {
    const system = new System(2);
    system.addNode({ id: "v1", restrained: [true, true] });
    system.addNode({ id: "v2", restrained: [true, true] });
    system.addNode({ id: "v3", restrained: [false, false], force: [0, -10] });
    system.addElement(
      new TrussElement2D("e1", { id: "v1", x: 0, z: 0 }, { id: "v3", x: 0, z: 4 }, 0.001, 2e7),
    );
    system.addElement(
      new TrussElement2D("e2", { id: "v2", x: 3, z: 0 }, { id: "v3", x: 0, z: 4 }, 0.001, 2e7),
    );

    expect(() => system.solve()).not.toThrow();
  });
});

describe("nullSpace · los movimientos de cuerpo rígido", () => {
  /** La armadura semilla, para mirar su `K` global sin condiciones de borde. */
  function global() {
    const system = new System(2);
    const puntos = { v1: [0, 0], v2: [3, 0], v3: [0, 4], v4: [3, 4] } as const;
    system.addNode({ id: "v1", restrained: [true, true] });
    system.addNode({ id: "v2", restrained: [true, true] });
    system.addNode({ id: "v3", restrained: [false, false], force: [4.8, -6.4] });
    system.addNode({ id: "v4", restrained: [false, false], force: [0, -6] });
    const barras: [string, keyof typeof puntos, keyof typeof puntos][] = [
      ["e1", "v1", "v2"],
      ["e2", "v3", "v4"],
      ["e3", "v1", "v3"],
      ["e4", "v2", "v4"],
      ["e5", "v1", "v4"],
      ["e6", "v2", "v3"],
    ];
    for (const [id, from, to] of barras) {
      system.addElement(
        new TrussElement2D(
          id,
          { id: from, x: puntos[from][0], z: puntos[from][1] },
          { id: to, x: puntos[to][0], z: puntos[to][1] },
          0.001,
          2e7,
        ),
      );
    }
    return system.solve().assembly;
  }

  it("la K **sin apoyos** tiene exactamente 3 modos nulos, y eso vale para toda estructura plana", () => {
    // No es un caso patológico ni una armadura mal armada: es la teoría. Los
    // modos nulos de una K sin condiciones de borde son los movimientos de
    // cuerpo rígido — dos traslaciones y una rotación en el plano, seis en el
    // espacio. Poner apoyos es sacarle esos modos.
    const modos = nullSpace(global().globalStiffness);

    expect(modos).toHaveLength(3);
  });

  it("con los apoyos puestos no queda ninguno: Kff es definida positiva", () => {
    expect(nullSpace(global().partition.kff)).toHaveLength(0);
  });

  it("ningún modo de cuerpo rígido deforma una barra", () => {
    // Es lo que los hace "de cuerpo rígido": no almacenan energía. Se comprueba
    // sobre la barra e1, horizontal de v1 a v2 — su alargamiento es la
    // proyección del desplazamiento relativo sobre su propio eje.
    const { globalStiffness } = global();
    for (const modo of nullSpace(globalStiffness)) {
      const [v1x, , v2x] = modo;
      const alargamiento = v2x - v1x; // e1 va de v1(0,0) a v2(3,0): eje x puro
      expect(alargamiento).toBeCloseTo(0, 8);
    }
  });
});

describe("loadCompatibility · qué significa que sea singular", () => {
  const modoHorizontal = [[1, 0, 1, 0]];

  it("una carga en la dirección del mecanismo no tiene equilibrio: acelera", () => {
    const { verdict } = loadCompatibility(modoHorizontal, [5, 0, 0, 0]);

    expect(verdict).toBe("accelerates");
  });

  it("una carga ortogonal deja infinitas soluciones, no ninguna", () => {
    // El caso de la armadura del bug: cargas verticales y modo horizontal. Hay
    // equilibrio; lo único indeterminado es la posición.
    const { verdict } = loadCompatibility(modoHorizontal, [0, -10, 0, -10]);

    expect(verdict).toBe("indeterminate");
  });

  it("sin carga no hay nada que empuje, así que es indeterminada", () => {
    expect(loadCompatibility(modoHorizontal, [0, 0, 0, 0]).verdict).toBe("indeterminate");
  });
});

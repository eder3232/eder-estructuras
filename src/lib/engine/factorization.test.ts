import { describe, expect, it } from "vitest";

import { ldl } from "./factorization";
import { System } from "./system";
import { TrussElement2D } from "./trusses-2d/truss-element-2d";

/** La armadura semilla de `/armaduras-2d`, para trabajar con una `K` de verdad. */
function armadura(apoyos: { v1: [boolean, boolean]; v2: [boolean, boolean] }) {
  const system = new System(2);
  const puntos = { v1: [0, 0], v2: [3, 0], v3: [0, 4], v4: [3, 4] } as const;
  system.addNode({ id: "v1", restrained: apoyos.v1 });
  system.addNode({ id: "v2", restrained: apoyos.v2 });
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
  return system;
}

const bienApoyada = () => armadura({ v1: [true, true], v2: [true, true] });

describe("ldl", () => {
  it("factoriza una matriz definida positiva y reconstruye la original", () => {
    const a = [
      [4, 2, 1],
      [2, 5, 3],
      [1, 3, 6],
    ];

    const resultado = ldl(a);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    // `L · D · Lᵀ` tiene que devolver la matriz de la que salió.
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const valor = resultado.d.reduce((sum, dk, k) => sum + resultado.l[i][k] * dk * resultado.l[j][k], 0);
        expect(valor).toBeCloseTo(a[i][j], 10);
      }
    }
  });

  it("todos los pivotes son positivos en una estructura bien apoyada", () => {
    const { partition } = bienApoyada().solve().assembly;

    const resultado = ldl(partition.kff);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.d).toHaveLength(partition.kff.length);
      for (const pivote of resultado.d) expect(pivote).toBeGreaterThan(0);
    }
  });

  it("falla en un pivote, y ese índice **es** el grado de libertad culpable", () => {
    // Un nudo al que solo llega una barra vertical: en x no lo sostiene nadie.
    const kff = [
      [1000, 0, 0],
      [0, 0, 0],
      [0, 0, 2000],
    ];

    const resultado = ldl(kff);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.failedAt).toBe(1);
      expect(resultado.pivot).toBe(0);
      // Los pivotes que sí salieron sirven igual: la factorización llegó hasta ahí.
      expect(resultado.d).toEqual([1000]);
    }
  });

  it("detecta el mecanismo que la inversa deja pasar", () => {
    // El caso que `inv` de mathjs no rechaza, porque el determinante le da 10⁻¹⁰
    // en vez de 0. Acá no hay ambigüedad: un pivote se apaga.
    //
    // La `Kff` del mecanismo se arma seleccionando filas y columnas de la global
    // en vez de resolviendo, porque `solve()` justamente tira. Se puede hacer
    // gracias a que **la matriz global no depende de los apoyos**: los apoyos
    // solo deciden qué filas entran en la partición.
    const { globalStiffness, dofOrder } = bienApoyada().solve().assembly;
    const libres = dofOrder
      .filter((d) => !((d.nodeId === "v1" || d.nodeId === "v2") && d.localDof === 1))
      .map((d) => d.globalIndex);
    const kff = libres.map((r) => libres.map((c) => globalStiffness[r][c]));

    const resultado = ldl(kff);

    expect(resultado.ok).toBe(false);
  });

  it("la tolerancia es relativa: el mismo pivote es cero o no según la escala de la matriz", () => {
    // Exactamente el mismo número en las dos, y el veredicto cambia. Con un
    // umbral absoluto esto sería imposible de distinguir, y es lo que hay que
    // distinguir: en rigideces de 10⁷ un pivote de 10⁻⁶ es ruido de redondeo;
    // en una matriz de números chicos es un valor legítimo.
    const enorme = ldl([
      [2e7, 0],
      [0, 1e-6],
    ]);
    const chica = ldl([
      [10, 0],
      [0, 1e-6],
    ]);

    expect(enorme.ok).toBe(false);
    if (!enorme.ok) expect(enorme.failedAt).toBe(1);
    expect(chica.ok).toBe(true);
  });
});


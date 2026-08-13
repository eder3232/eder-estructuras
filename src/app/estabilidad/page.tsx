"use client";

import { det, inv } from "mathjs";

import {
  conditionEstimate,
  ldl,
  loadCompatibility,
  nullSpace,
  spectrum,
  type AssemblyResult,
} from "@/lib/engine";
import { DeformedDiagram } from "@/components/custom/diagram-2d/deformed-diagram";
import { SchemaDiagram } from "@/components/custom/diagram-2d/schema-diagram";
import { Math as Tex, MathBlock } from "@/components/custom/math";
import { MatrixTable } from "@/components/custom/matrix-table";
import { cn } from "@/lib/utils";
import {
  ELEMENTS,
  ELASTICITY,
  NODES,
  buildExample,
  dofLabels,
  freeDofs,
  submatrix,
} from "./example";

/**
 * Por qué la matriz de rigidez es singular, y qué hacer con eso.
 *
 * **Por qué existe esta página.** El método se enseña —y la app lo mostraba—
 * como una receta que siempre termina en un número. Pero la matriz global es
 * singular *siempre*, poner apoyos es exactamente sacarle esa singularidad, y
 * cuando no alcanzan el sistema no «se rompe»: deja de tener solución única, que
 * es una afirmación con contenido físico. Nada de eso aparece en el recorrido
 * normal del cálculo, y es lo que separa aplicar la receta de entenderla.
 *
 * Va en una página propia y no en el acordeón de un sistema por una razón
 * práctica: **el caso más interesante es el que no se puede mostrar ahí**. Si la
 * estructura cargada es un mecanismo, el panel de resultados no se renderiza.
 */
export default function EstabilidadPage() {
  const example = buildExample();
  const { assembly } = example;
  const { globalStiffness } = assembly;
  const labels = dofLabels(assembly);
  const free = freeDofs(assembly);

  const kffStable = submatrix(globalStiffness, free.stable);
  const kffMechanism = submatrix(globalStiffness, free.mechanism);
  const labelsOf = (indices: number[]) => indices.map((i) => labels[i]);

  return (
    <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-10 px-6 py-10 [&_p]:max-w-3xl">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Por qué la matriz es singular</h1>
        <p className="text-sm text-muted-foreground">
          El método de rigideces se enseña como una receta que termina en un número. Esta página es sobre lo que pasa
          cuando no termina — y sobre por qué eso no es una falla del programa sino una respuesta.
        </p>
      </header>

      <Block
        n={1}
        title="La matriz global es singular siempre"
        lead="Incluso en una estructura perfectamente apoyada. No es un caso raro: es la teoría."
      >
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">El ejemplo de toda la página</span>
            <SchemaDiagram nodes={[...NODES]} elements={[...ELEMENTS]} supports={[]} forces={[]} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              <Tex tex="K" /> sin condiciones de borde (6×6)
            </span>
            <MatrixTable matrix={globalStiffness} labels={labels} symmetricHighlight />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Sus autovalores son la rigidez del sistema en cada dirección propia: cuánto cuesta cada movimiento posible.
          Y hay <span className="font-medium text-foreground">exactamente tres que valen cero</span>:
        </p>

        <Spectrum values={spectrum(globalStiffness)} />

        <p className="text-sm text-muted-foreground">
          Tres en el plano, seis en el espacio, y siempre los mismos tres: no dependen de cuántas barras tenga ni de
          cómo estén puestas. <span className="font-medium text-foreground">Poner apoyos es exactamente sacarle esos
          tres modos</span> — ni uno más, porque cada apoyo de más vuelve la estructura hiperestática pero no cambia
          esto.
        </p>
      </Block>

      <Block
        n={2}
        title="Los tres movimientos que no cuestan energía"
        lead="Un autovalor nulo no es un número raro: es un movimiento que se puede hacer gratis."
      >
        <p className="text-sm text-muted-foreground">
          Cada uno de esos tres autovalores tiene su vector propio, y ese vector <em>es</em> un movimiento de la
          estructura. Dibujados, son los movimientos de cuerpo rígido de toda la vida — y lo que tienen en común es
          que <span className="font-medium text-foreground">ninguna barra cambia de longitud</span>. Sin deformación
          no hay energía almacenada, y sin energía no hace falta ninguna fuerza para producirlos.
        </p>

        <div className="flex flex-wrap gap-6">
          {nullSpace(globalStiffness).map((mode, i) => (
            <div key={i} className="flex flex-col gap-1">
              <span className="text-sm font-medium">Modo {i + 1}</span>
              <DeformedDiagram
                nodes={[...NODES]}
                elements={[...ELEMENTS]}
                displacements={modeToDisplacements(assembly, mode)}
                reactions={[]}
                elementForceValue={new Map()}
                scale={{ initial: 1, max: 3, step: 0.1 }}
                showZeroAxialLabels={false}
                legend={<>Punteado: la posición original. Sólido: el movimiento, que no estira ninguna barra.</>}
              />
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          Los que salen son combinaciones de las dos traslaciones y la rotación — cualquier base del mismo plano de
          movimientos sirve, porque lo que está definido es el <em>espacio</em>, no los tres vectores concretos.
        </p>
      </Block>

      <Block
        n={3}
        title="Los apoyos sacan esos modos"
        lead="Tachar las filas y columnas de los grados de libertad restringidos es lo que vuelve invertible la matriz."
      >
        <p className="text-sm text-muted-foreground">
          Con <Tex tex="v_1" /> fijo y <Tex tex="v_2" /> sobre un rodillo quedan tres grados de libertad libres, y esa
          submatriz de 3×3 ya <span className="font-medium text-foreground">no tiene ningún autovalor nulo</span>: es
          definida positiva. Cualquier movimiento cuesta energía, así que hay una sola configuración en equilibrio.
        </p>

        <div className="flex flex-wrap items-start gap-8">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              <Tex tex="K_{ff}" /> con apoyos suficientes
            </span>
            <MatrixTable matrix={kffStable} labels={labelsOf(free.stable)} symmetricHighlight />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              <Tex tex="K_{ff}" /> con los dos apoyos solo verticales
            </span>
            <MatrixTable matrix={kffMechanism} labels={labelsOf(free.mechanism)} symmetricHighlight />
          </div>
        </div>

        <div className="flex flex-wrap gap-8">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">Apoyos suficientes: todos positivos</span>
            <Spectrum values={spectrum(kffStable)} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">Sin apoyo horizontal: vuelve a haber un cero</span>
            <Spectrum values={spectrum(kffMechanism)} />
          </div>
        </div>
      </Block>

      <Block
        n={4}
        title="Por qué el determinante no sirve para darse cuenta"
        lead="Es el primer test que a uno se le ocurre, y es el equivocado."
      >
        <p className="text-sm text-muted-foreground">
          En aritmética exacta el determinante de una matriz singular da cero. En punto flotante{" "}
          <span className="font-medium text-foreground">nunca</span>: da 10⁻¹⁰, 10⁻¹⁶, lo que salga del redondeo. Y hay
          un problema peor, que no es de precisión sino de significado —{" "}
          <span className="font-medium text-foreground">el determinante depende de las unidades</span>. Acá está la
          misma estructura, con el mismo apoyo y la misma estabilidad, cambiando solo el módulo de elasticidad:
        </p>

        <ScaleComparison stable={free.stable} />

        <p className="text-sm text-muted-foreground">
          Multiplicar <Tex tex="E" /> por 1000 multiplica el determinante por <Tex tex="1000^n" />, y la estructura no
          se enteró. Un número que cambia doce órdenes de magnitud sin que cambie nada físico no puede ser el criterio.
          El <span className="font-medium text-foreground">número de condición</span>, en cambio, es un cociente entre
          rigideces: es adimensional y ni se mueve.
        </p>
      </Block>

      <Block
        n={5}
        title="Lo que hace un programa de cálculo"
        lead="No invierte la matriz: la factoriza. Y la factorización falla sola, en el lugar exacto."
      >
        <p className="text-sm text-muted-foreground">
          Una matriz simétrica y definida positiva se factoriza como <Tex tex="K = L \cdot D \cdot L^{T}" />, donde{" "}
          <Tex tex="D" /> son los <span className="font-medium text-foreground">pivotes</span>. Es más rápido y más
          estable que invertir, pero lo importante acá es otra cosa: si la matriz deja de ser definida positiva, la
          factorización <span className="font-medium text-foreground">se detiene en un pivote nulo o negativo</span>.
          El control de estabilidad no es un chequeo agregado encima del cálculo — es el cálculo, que no puede seguir.
        </p>

        <MathBlock tex="d_j = k_{jj} - \sum_{k<j} l_{jk}^2 \, d_k \qquad \text{con } d_j > 0 \text{ para toda } j" />

        <div className="flex flex-wrap gap-8">
          <Pivots title="Apoyos suficientes" labels={labelsOf(free.stable)} matrix={kffStable} />
          <Pivots title="Sin apoyo horizontal" labels={labelsOf(free.mechanism)} matrix={kffMechanism} />
        </div>

        <p className="text-sm text-muted-foreground">
          Y como la factorización va en el orden de los grados de libertad, el pivote que falla{" "}
          <span className="font-medium text-foreground">señala un lugar</span>, no un número abstracto. Por eso los
          programas comerciales no dicen «la matriz es singular» sino cosas como{" "}
          <em>instability at joint 5, degree of freedom UX</em>.
        </p>

        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Con un matiz que conviene saber</span>, y que se ve en el
          ejemplo de arriba: el pivote se apagó en <Tex tex="v_3x" />, pero <Tex tex="v_3" /> está perfectamente
          sujeto por sus dos barras. Lo que pasa es que el movimiento libre es de{" "}
          <span className="font-medium text-foreground">toda la estructura</span>, y la factorización lo descubre
          recién al llegar al último grado horizontal: con los anteriores ya fijados, a ese no le queda rigidez propia.
          O sea que el pivote dice <span className="font-medium text-foreground">dónde se agota el cálculo</span>, y
          eso coincide con el culpable solo cuando el culpable es un grado de libertad suelto de verdad — un nudo sin
          conectar, por ejemplo. En un mecanismo global no hay un culpable único, y el mensaje de un programa comercial
          tiene exactamente la misma letra chica.
        </p>
      </Block>

      <Block
        n={6}
        title="Qué significa que sea singular"
        lead="No es que no haya respuesta: es que hay dos respuestas posibles, y son muy distintas."
      >
        <p className="text-sm text-muted-foreground">
          Como <Tex tex="K" /> es simétrica, su imagen es el complemento ortogonal de su núcleo. O sea que{" "}
          <Tex tex="K \cdot U = F" /> tiene solución <span className="font-medium text-foreground">si y solo si</span>{" "}
          la carga es ortogonal a los modos nulos. De ahí salen los dos casos, y hay que mirar la carga para saber en
          cuál se está:
        </p>

        <FredholmCases matrix={kffMechanism} labels={labelsOf(free.mechanism)} free={free.mechanism} assembly={assembly} />

        <p className="text-sm text-muted-foreground">
          El segundo caso explica algo que suena imposible: una estructura que «no se puede resolver» pero cuyos
          esfuerzos <span className="font-medium text-foreground">sí</span> están determinados. Como el movimiento libre
          no deforma ninguna barra, sumarlo no cambia ninguna fuerza interna — lo único indeterminado es dónde queda
          parada.
        </p>

        <div className="rounded-md border border-dashed p-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Qué hace esta app, para no mentir:</span> resuelve invirtiendo{" "}
            <Tex tex="K_{ff}" /> con mathjs y comprueba la estabilidad con el número de condición, no con la
            factorización de arriba. Es un sustituto razonable —detecta lo mismo— pero no es lo que haría un programa de
            cálculo serio, y los pivotes de esta página se calculan aparte solo para mostrarlos. Que la app resuelva
            factorizando es una mejora anotada, no algo que ya esté.
          </p>
        </div>
      </Block>
    </div>
  );
}

/** Una sección numerada, para que la página se lea como un recorrido y no como notas. */
function Block({
  n,
  title,
  lead,
  children,
}: {
  n: number;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          {n}. {title}
        </h2>
        <p className="text-sm text-muted-foreground">{lead}</p>
      </div>
      {children}
    </section>
  );
}

const ZERO = 1e-8;

/** Los autovalores como fichas, con los ceros marcados: es lo único que hay que ver. */
function Spectrum({ values }: { values: number[] }) {
  const largest = Math.max(...values.map(Math.abs), 1);

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value, i) => {
        const isZero = Math.abs(value) <= ZERO * largest;
        return (
          <span
            key={i}
            className={cn(
              "rounded-md border px-2 py-1 text-sm tabular-nums",
              isZero
                ? "border-destructive bg-destructive/20 font-semibold"
                : "text-muted-foreground",
            )}
          >
            {isZero ? "0" : value.toExponential(3)}
          </span>
        );
      })}
    </div>
  );
}

/** El determinante y el número de condición de la misma matriz a dos escalas. */
function ScaleComparison({ stable }: { stable: number[] }) {
  const rows = [ELASTICITY, ELASTICITY * 1000].map((elasticity) => {
    const kff = submatrix(buildExample(elasticity).assembly.globalStiffness, stable);
    return {
      elasticity,
      determinant: det(kff),
      condition: conditionEstimate(kff, inv(kff) as number[][]),
    };
  });

  return (
    <table className="w-fit border-collapse text-sm">
      <thead>
        <tr>
          <th className="border px-3 py-1 text-left font-medium text-muted-foreground">Módulo E</th>
          <th className="border px-3 py-1 text-right font-medium text-muted-foreground">Determinante</th>
          <th className="border px-3 py-1 text-right font-medium text-muted-foreground">Número de condición</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.elasticity}>
            <td className="border px-3 py-1 tabular-nums">{row.elasticity.toExponential(0)}</td>
            <td className="border px-3 py-1 text-right tabular-nums">{row.determinant.toExponential(3)}</td>
            <td className="border px-3 py-1 text-right tabular-nums">{row.condition.toExponential(3)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Los pivotes de la factorización, en el orden de los grados de libertad. */
function Pivots({ title, labels, matrix }: { title: string; labels: string[]; matrix: number[][] }) {
  const result = ldl(matrix);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{title}</span>
      <table className="w-fit border-collapse text-sm">
        <tbody>
          {labels.map((label, i) => {
            const failed = !result.ok && result.failedAt === i;
            const pivot = result.ok ? result.d[i] : result.d[i];
            return (
              <tr key={label}>
                <th className="border px-3 py-1 text-left font-medium text-muted-foreground">{label}</th>
                <td
                  className={cn(
                    "border px-3 py-1 text-right tabular-nums",
                    failed && "bg-destructive/25 font-semibold",
                  )}
                >
                  {failed
                    ? result.pivot.toExponential(2)
                    : pivot !== undefined
                      ? pivot.toExponential(3)
                      : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {result.ok ? (
        <span className="text-xs text-muted-foreground">Los {result.d.length} pivotes son positivos: estable.</span>
      ) : (
        <span className="text-xs text-destructive">
          Se detiene en <span className="font-medium">{labels[result.failedAt]}</span>: con los anteriores ya fijados,
          a ese grado de libertad no le queda rigidez.
        </span>
      )}
    </div>
  );
}

/** Los dos veredictos de Fredholm sobre el mismo mecanismo, cargado distinto. */
function FredholmCases({
  matrix,
  labels,
  free,
  assembly,
}: {
  matrix: number[][];
  labels: string[];
  free: number[];
  assembly: AssemblyResult;
}) {
  const modes = nullSpace(matrix);
  const horizontalAt = free.findIndex((globalIndex) => assembly.dofOrder[globalIndex].localDof === 0);
  const verticalAt = free.findIndex((globalIndex) => assembly.dofOrder[globalIndex].localDof === 1);

  const cases = [
    {
      title: "Carga horizontal en un nudo",
      forces: free.map((_, i) => (i === horizontalAt ? 10 : 0)),
    },
    {
      title: "Carga vertical en un nudo",
      forces: free.map((_, i) => (i === verticalAt ? -10 : 0)),
    },
  ];

  return (
    <div className="flex flex-wrap gap-6">
      {cases.map((item) => {
        const { verdict, projections } = loadCompatibility(modes, item.forces);
        return (
          <div
            key={item.title}
            className={cn(
              "flex max-w-md flex-col gap-2 rounded-md border p-4",
              verdict === "accelerates" ? "border-destructive/60" : "border-amber-500/60",
            )}
          >
            <span className="text-sm font-medium">{item.title}</span>
            <table className="w-fit border-collapse text-xs">
              <tbody>
                <tr>
                  {labels.map((label) => (
                    <th key={label} className="border px-2 py-1 font-medium text-muted-foreground">
                      {label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {item.forces.map((value, i) => (
                    <td key={i} className="border px-2 py-1 text-right tabular-nums">
                      {value}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="text-sm">
              {verdict === "accelerates" ? (
                <>
                  <span className="font-medium text-destructive">No hay equilibrio posible.</span> La carga tiene
                  componente en la dirección del movimiento libre (proyección {projections[0]?.toFixed(3)}), así que la
                  estructura acelera. La estática no tiene nada que responder: es un problema de dinámica.
                </>
              ) : (
                <>
                  <span className="font-medium text-amber-600 dark:text-amber-400">Infinitas soluciones.</span> La carga
                  es ortogonal al movimiento libre (proyección {projections[0]?.toFixed(3)}), así que hay equilibrio —
                  pero en infinitas posiciones. Los esfuerzos quedan determinados; el desplazamiento, no.
                </>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Un modo, repartido por nudo, como lo consume el diagrama. */
function modeToDisplacements(assembly: AssemblyResult, mode: number[]): Map<string, [number, number]> {
  const displacements = new Map<string, [number, number]>(NODES.map((n) => [n.id, [0, 0]]));

  assembly.dofOrder.forEach((dof, i) => {
    const vector = displacements.get(dof.nodeId);
    if (vector) vector[dof.localDof] = mode[i] ?? 0;
  });

  return displacements;
}

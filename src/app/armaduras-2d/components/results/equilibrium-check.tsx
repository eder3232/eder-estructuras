"use client";

import { CheckIcon, TriangleAlertIcon } from "lucide-react";

import { useDecimals } from "@/components/custom/decimals-scope";
import { Math, MathBlock } from "@/components/custom/math";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EQUILIBRIUM_TOLERANCE, type EquilibriumCheck } from "@/lib/engine";
import type { NodeRow } from "../../store/nodes";

/** El `Math` de JS, tapado en este archivo por el componente de KaTeX del mismo nombre. */
const jsMath = globalThis.Math;

/**
 * La raya que separa el total, como se escribe una suma.
 *
 * **Va en las celdas y no en el `tr`**, y no es capricho: `TableBody` lleva
 * `[&_tr:last-child]:border-0`, que es un descendiente y le gana por
 * especificidad a cualquier `border-t-2` puesto en la fila — la raya
 * simplemente no se dibujaba. Lo encontró la captura, midiendo.
 *
 * Y es una raya y no un fondo porque un fondo acá no se ve: `bg-muted/30` medía
 * 5/255 contra el blanco, y subirlo no alcanza porque en esta paleta `--muted`
 * está pegado al fondo.
 */
const TOTAL = "border-t-2 border-t-foreground/40";

/**
 * El sello del título de la sección.
 *
 * Va en el `AccordionTrigger` para que la pregunta *¿puedo confiar en esto?* se
 * conteste **sin desplegar nada**, que es lo que se pierde si la verificación
 * vive solo adentro de una sección cerrada. La cuenta —que es lo que enseña—
 * está adentro.
 *
 * `Badge` es `inline-flex`, así que crea su propio contexto de formato y **no
 * hereda el subrayado** que el trigger se pone al pasar el mouse.
 */
export function EquilibriumBadge({ equilibrium }: { equilibrium: EquilibriumCheck }) {
  return equilibrium.ok ? (
    <Badge className="rounded-sm bg-primary px-2 py-0.5 text-primary-foreground">
      <CheckIcon aria-hidden />
      Equilibrio verificado
    </Badge>
  ) : (
    <Badge className="rounded-sm bg-destructive px-2 py-0.5 text-background">
      <TriangleAlertIcon aria-hidden />
      El equilibrio no cierra
    </Badge>
  );
}

/**
 * N5, el cierre del recorrido: **cada nudo tiene que estar en equilibrio**.
 *
 * Es la comprobación que el alumno hace a mano con el método de los nudos —y la
 * que este repo venía haciendo en scripts de regresión, fuera de la app—. Que
 * esté a la vista cambia lo que la página es: no muestra un resultado, muestra
 * un resultado **comprobado**, con la comprobación hecha del modo en que se
 * hace en el pizarrón.
 *
 * El cálculo vive en `engine/equilibrium.ts`, con el porqué de que no sea una
 * tautología.
 */
export function EquilibriumSection({
  equilibrium,
  nodesById,
}: {
  equilibrium: EquilibriumCheck;
  nodesById: Map<string, NodeRow>;
}) {
  const decimals = useDecimals();
  const tolerance = jsMath.max(EQUILIBRIUM_TOLERANCE * equilibrium.scale, 1e-9);

  const sum = (pick: (node: EquilibriumCheck["nodes"][number]) => number[]) =>
    equilibrium.nodes.reduce(
      (total, node) => total.map((value, i) => value + pick(node)[i]),
      [0, 0],
    );
  const appliedTotal = sum((n) => n.applied);
  const reactionTotal = sum((n) => n.reaction);

  /**
   * La celda del residuo dice **si cerró**, no cuánto dio: con 4 decimales
   * todas las filas mostrarían `0.0000`, que es una respuesta que no se puede
   * distinguir de un cero de verdad ni de un error tapado por el redondeo. El
   * número honesto —el mayor residuo de todos, en notación exponencial— va una
   * sola vez, abajo.
   */
  const residualCell = (value: number) =>
    jsMath.abs(value) <= tolerance ? (
      <span className="text-muted-foreground">≈ 0</span>
    ) : (
      <span className="font-medium text-destructive">{value.toFixed(decimals)}</span>
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        El método terminó, pero nada de lo anterior demuestra que el resultado sea correcto. La comprobación es la
        misma que se hace en el pizarrón: <span className="font-medium text-foreground">nudo por nudo</span>, las
        barras que llegan tiran de él, la carga lo empuja y el apoyo lo sostiene. Los tres tienen que sumar cero.
      </p>
      <MathBlock tex="\sum F_x = 0 \qquad \sum F_z = 0 \qquad \text{en cada nudo}" />
      <p className="text-sm text-muted-foreground">
        El aporte de cada barra es su fuerza axial <Math tex="N" /> proyectada sobre los dos ejes (
        <Math tex="N\,C_x" /> y <Math tex="N\,C_z" />, con la sección 4), y apunta{" "}
        <span className="font-medium text-foreground">hacia la otra punta</span> de la barra: una barra traccionada
        tira de sus dos nudos hacia adentro.
      </p>

      <div className="max-w-full overflow-x-auto">
        <Table className="border">
          {/* Encabezado de dos niveles, igual que la tabla de nudos: la
              magnitud arriba y el eje abajo. Ocho columnas de números con el
              rótulo repetido en cada una serían ilegibles. */}
          <TableHeader>
            <TableRow className="border-b-0">
              <TableHead rowSpan={2}>Nudo</TableHead>
              <TableHead colSpan={2} className="h-9 border-l text-center">
                Barras que llegan
              </TableHead>
              <TableHead colSpan={2} className="h-9 border-l text-center">
                Carga aplicada
              </TableHead>
              <TableHead colSpan={2} className="h-9 border-l text-center">
                Reacción
              </TableHead>
              <TableHead colSpan={2} className="h-9 border-l text-center">
                Suma
              </TableHead>
            </TableRow>
            <TableRow>
              {["X", "Z", "X", "Z", "X", "Z", "X", "Z"].map((axis, i) => (
                <TableHead key={i} className={`h-8 text-center ${i % 2 === 0 ? "border-l" : ""}`}>
                  {axis}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {equilibrium.nodes.map((node) => (
              <TableRow key={node.nodeId}>
                <TableCell className="font-medium">{nodesById.get(node.nodeId)?.name ?? node.nodeId}</TableCell>
                <TableCell className="border-l text-right tabular-nums">
                  {node.fromElements[0].toFixed(decimals)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{node.fromElements[1].toFixed(decimals)}</TableCell>
                <TableCell className="border-l text-right tabular-nums">{node.applied[0].toFixed(decimals)}</TableCell>
                <TableCell className="text-right tabular-nums">{node.applied[1].toFixed(decimals)}</TableCell>
                <TableCell className="border-l text-right tabular-nums">
                  {node.reaction[0].toFixed(decimals)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{node.reaction[1].toFixed(decimals)}</TableCell>
                <TableCell className="border-l text-right tabular-nums">{residualCell(node.residual[0])}</TableCell>
                <TableCell className="text-right tabular-nums">{residualCell(node.residual[1])}</TableCell>
              </TableRow>
            ))}
            {/* La fila de la estructura entera. No lleva columna de barras, y
                esa ausencia es la lección: ver el párrafo de abajo. */}
            <TableRow className="font-medium">
              <TableCell className={TOTAL}>Toda la estructura</TableCell>
              <TableCell colSpan={2} className={`${TOTAL} border-l text-center text-xs text-muted-foreground`}>
                se cancelan
              </TableCell>
              <TableCell className={`${TOTAL} border-l text-right tabular-nums`}>
                {appliedTotal[0].toFixed(decimals)}
              </TableCell>
              <TableCell className={`${TOTAL} text-right tabular-nums`}>{appliedTotal[1].toFixed(decimals)}</TableCell>
              <TableCell className={`${TOTAL} border-l text-right tabular-nums`}>
                {reactionTotal[0].toFixed(decimals)}
              </TableCell>
              <TableCell className={`${TOTAL} text-right tabular-nums`}>
                {reactionTotal[1].toFixed(decimals)}
              </TableCell>
              <TableCell className={`${TOTAL} border-l text-right tabular-nums`}>
                {residualCell(equilibrium.global[0])}
              </TableCell>
              <TableCell className={`${TOTAL} text-right tabular-nums`}>
                {residualCell(equilibrium.global[1])}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Por qué la última fila no tiene columna de barras:</span> cada
        barra tira de sus dos nudos con fuerzas iguales y opuestas, así que al sumar toda la estructura se cancelan
        de a pares. Lo que queda es lo que entra y sale del sistema — las cargas y las reacciones—, y por eso ese
        control se puede hacer sin resolver nada. Es también la razón por la que un apoyo de más no cambia la suma:
        cambia el reparto.
      </p>

      <p className="text-sm text-muted-foreground">
        {equilibrium.ok ? (
          <>
            <span className="font-medium text-foreground">Cierra.</span> El mayor residuo de toda la tabla es{" "}
            <span className="tabular-nums">{equilibrium.maxResidual.toExponential(1)}</span> contra fuerzas del orden
            de <span className="tabular-nums">{equilibrium.scale.toFixed(2)}</span>: eso es{" "}
            <span className="font-medium text-foreground">redondeo del punto flotante</span>, no un error. Una
            computadora no da cero exacto casi nunca, así que la pregunta correcta no es «¿da cero?» sino «¿es
            despreciable frente a las fuerzas en juego?».
          </>
        ) : (
          <>
            <span className="font-medium text-destructive">No cierra</span>, y eso{" "}
            <span className="font-medium text-foreground">no es un problema de tu modelo</span>: el mayor residuo es{" "}
            <span className="tabular-nums">{equilibrium.maxResidual.toExponential(1)}</span> contra fuerzas del orden
            de <span className="tabular-nums">{equilibrium.scale.toFixed(2)}</span>, que es demasiado para ser
            redondeo. Los números de arriba no son confiables — conviene reportarlo.
          </>
        )}
      </p>

      <p className="text-xs text-muted-foreground">
        Este control vuelve a armar las fuerzas desde la rigidez de{" "}
        <span className="font-medium text-foreground">cada barra</span>, sin pasar por la matriz global ni por la
        partición, así que atrapa un error de ensamblaje, de mapeo de grados de libertad o de signo al partir. Lo que
        no puede ver es un error adentro de la rigidez de la barra: esa misma rigidez se usa de los dos lados de la
        cuenta.
      </p>
    </div>
  );
}

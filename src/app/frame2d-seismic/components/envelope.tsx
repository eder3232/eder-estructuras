"use client";

import { useMemo, useState } from "react";
import { useAtomValue } from "jotai";

import type { EnvelopePoint } from "@/lib/engine";
import { useDecimals } from "@/components/custom/decimals-scope";
import { InternalForceDiagram, type MemberCurve } from "@/components/custom/diagram-2d/internal-force-diagram";
import type { DiagramElement, DiagramSupport } from "@/components/custom/diagram-2d/types";
import { NoResults } from "@/components/custom/no-results";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QUANTITY, curveOf, type Quantity } from "@/app/frame2d/components/results/member-diagrams";
import { atomElements } from "@/app/frame2d/store/elements";
import { atomCombinationResults, type CombinationsResult } from "../store/analysis";
import { caseViews } from "../store/cases";
import { num } from "./format";

const ENVELOPE = "envelope";

const REASON: Record<Extract<CombinationsResult, { status: "unavailable" }>["reason"], string> = {
  "case-error": "Algún caso no se pudo resolver: el detalle está en su procedimiento, más arriba.",
  "no-combinations": "No hay combinaciones: agregá al menos una en la tabla de combinaciones.",
};

/** El extremo de una curva de la envolvente: el número que interesa para diseñar. */
function extreme(points: EnvelopePoint[], quantity: Quantity, which: "max" | "min") {
  return points.reduce((best, p) =>
    which === "max" ? (p.max[quantity] > best.max[quantity] ? p : best) : p.min[quantity] < best.min[quantity] ? p : best,
  );
}

/**
 * Las dos curvas de la envolvente de una barra. **Se rotula poco**, porque dos
 * curvas por barra son el doble de números y se pisaban (paso 6 y, en un
 * pórtico de dos vanos, de nuevo en los nudos interiores: paso 7). La regla es
 * la del que diseña:
 * - **En cada extremo, un solo número: el que manda**, el de mayor módulo
 *   entre el máximo y el mínimo.
 * - Adentro de la barra, el valor más grande de cada curva si es un máximo
 *   interior (el de una viga cargada) y llega a la mitad del mayor de la barra.
 * - Un esfuerzo constante (N de una columna) va una vez, a mitad de la barra.
 * El resto está en la tabla de abajo.
 */
function envelopeCurves(points: EnvelopePoint[], quantity: Quantity, length: number): { max: MemberCurve; min: MemberCurve } {
  const sample = (which: "max" | "min") =>
    points.map((p) => ({ x: p.x, value: which === "max" ? p.max[quantity] : p.min[quantity] }));
  const max = sample("max");
  const min = sample("min");
  const biggest = Math.max(...[...max, ...min].map((c) => Math.abs(c.value)));
  const governs = (value: number, which: "max" | "min") => (which === "max" ? value > 0 : value < 0);
  const labels: Record<"max" | "min", { x: number; value: number }[]> = { max: [], min: [] };

  const constant = (curve: { value: number }[]) =>
    curve.every((c) => Math.abs(c.value - curve[0].value) <= 1e-9 * (1 + biggest));
  if (constant(max) && constant(min)) {
    const which = Math.abs(max[0].value) >= Math.abs(min[0].value) ? "max" : "min";
    const value = which === "max" ? max[0].value : min[0].value;
    if (governs(value, which)) labels[which].push({ x: length / 2, value });
    return { max: { points: max, labels: labels.max }, min: { points: min, labels: labels.min } };
  }

  for (const index of [0, points.length - 1]) {
    const which = Math.abs(max[index].value) >= Math.abs(min[index].value) ? "max" : "min";
    const value = which === "max" ? max[index].value : min[index].value;
    if (governs(value, which)) labels[which].push({ x: index === 0 ? 0 : length, value });
  }
  for (const which of ["max", "min"] as const) {
    const top = extreme(points, quantity, which);
    const value = which === "max" ? top.max[quantity] : top.min[quantity];
    const interior = top.x > 1e-9 && top.x < length - 1e-9;
    if (interior && governs(value, which) && Math.abs(value) >= 0.5 * biggest) labels[which].push({ x: top.x, value });
  }
  return { max: { points: max, labels: labels.max }, min: { points: min, labels: labels.min } };
}

/**
 * La envolvente de diseño: en cada punto de cada barra, **el máximo y el
 * mínimo** de cada esfuerzo entre todas las combinaciones, y qué combinación
 * los da. Con el sismo en los dos sentidos, una misma sección puede tener que
 * resistir momentos de los dos signos.
 */
export function Envelope() {
  const result = useAtomValue(atomCombinationResults);
  const elements = useAtomValue(atomElements);
  const nodes = useAtomValue(caseViews.CM.atomNodes);
  const d = useDecimals();
  const [quantity, setQuantity] = useState<Quantity>("M");
  const [view, setView] = useState<string>(ENVELOPE);

  const supports: DiagramSupport[] = useMemo(
    () =>
      nodes
        .filter((n) => n.restrainedX || n.restrainedZ || n.restrainedR)
        .map((n) => ({
          nodeId: n.id,
          x: n.x,
          z: n.z,
          restrainedX: n.restrainedX,
          restrainedZ: n.restrainedZ,
          restrainedRotation: n.restrainedR,
        })),
    [nodes],
  );

  if (result.status !== "ok") return <NoResults tone="empty" title="Sin envolvente">{REASON[result.reason]}</NoResults>;

  const names = new Map(result.combinations.map((c) => [c.combination.id, c.combination.name]));
  const single = result.combinations.find((c) => c.combination.id === view);

  // La envolvente son **dos** curvas por barra: se dibujan como dos barras
  // superpuestas, y donde las dos tienen el mismo signo se ve la banda.
  const drawnElements: DiagramElement[] = single
    ? elements
    : elements.flatMap((e) => [
        { ...e, id: `${e.id}·max` },
        { ...e, id: `${e.id}·min` },
      ]);
  const curves = new Map<string, MemberCurve>();
  for (const element of elements) {
    if (single) {
      const diagram = single.diagrams.get(element.id);
      if (diagram) curves.set(element.id, curveOf(diagram, quantity));
      continue;
    }
    const points = result.envelope.get(element.id);
    const length = result.combinations[0].diagrams.get(element.id)?.length ?? 0;
    if (!points || points.length === 0) continue;
    const { max, min } = envelopeCurves(points, quantity, length);
    curves.set(`${element.id}·max`, max);
    curves.set(`${element.id}·min`, min);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Cada combinación es la suma de los tres casos por sus factores —el análisis es lineal—, así que no se
        resuelve de nuevo: sus diagramas son exactos, con sus propios máximos. La <strong>envolvente</strong> toma,
        en cada punto de cada barra, el mayor y el menor valor entre todas: es lo que la sección tiene que poder
        resistir. Con el sismo en los dos sentidos, los extremos de las vigas y las columnas reciben momentos de los
        dos signos.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Qué dibujar">
          <Button
            size="sm"
            variant={view === ENVELOPE ? "default" : "outline"}
            aria-pressed={view === ENVELOPE}
            onClick={() => setView(ENVELOPE)}
          >
            Envolvente
          </Button>
          {result.combinations.map(({ combination }) => (
            <Button
              key={combination.id}
              size="sm"
              variant={view === combination.id ? "default" : "outline"}
              aria-pressed={view === combination.id}
              onClick={() => setView(combination.id)}
              // Los nombres son fórmulas: en mayúsculas, «CM» y «cm» serían lo mismo, pero el + y el − no se leen.
              className="normal-case"
            >
              {combination.name}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Qué esfuerzo dibujar">
          {(Object.keys(QUANTITY) as Quantity[]).map((q) => (
            <Button
              key={q}
              size="sm"
              variant={q === quantity ? "default" : "outline"}
              aria-pressed={q === quantity}
              onClick={() => setQuantity(q)}
            >
              {QUANTITY[q].title}
            </Button>
          ))}
        </div>
      </div>

      <InternalForceDiagram
        nodes={nodes}
        elements={drawnElements}
        supports={supports}
        curves={curves}
        positiveSide={QUANTITY[quantity].side}
        mergeJointLabels={quantity === "M"}
        unsigned={quantity === "M"}
        // Los números están todos en la tabla de abajo: el que no tiene lugar no se escribe.
        skipCrowdedLabels
      />

      <h4 className="font-medium">{QUANTITY[quantity].title}: el máximo y el mínimo de cada barra</h4>
      <div className="max-w-full overflow-x-auto">
        <Table className="w-auto border">
          <TableHeader>
            <TableRow>
              <TableHead>Barra</TableHead>
              <TableHead className="text-right">Máximo</TableHead>
              <TableHead className="text-right">en x</TableHead>
              <TableHead>Combinación</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">en x</TableHead>
              <TableHead>Combinación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {elements.map((element) => {
              const points = result.envelope.get(element.id);
              if (!points || points.length === 0) return null;
              const top = extreme(points, quantity, "max");
              const bottom = extreme(points, quantity, "min");
              return (
                <TableRow key={element.id}>
                  <TableCell>{element.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(top.max[quantity], d)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(top.x, 2)}</TableCell>
                  <TableCell className="text-sm">{names.get(top.maxBy[quantity])}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(bottom.min[quantity], d)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(bottom.x, 2)}</TableCell>
                  <TableCell className="text-sm">{names.get(bottom.minBy[quantity])}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="max-w-3xl text-xs text-muted-foreground">
        Convención de las tablas de Pórticos 2D: N {QUANTITY.N.rule}; V {QUANTITY.V.rule}; M {QUANTITY.M.rule}.{" "}
        <code>x</code> se mide a lo largo de la barra desde su nudo «desde».
      </p>

      <h4 className="font-medium">Reacciones: el máximo y el mínimo de cada apoyo</h4>
      <div className="max-w-full overflow-x-auto">
        <Table className="w-auto border">
          <TableHeader>
            <TableRow>
              <TableHead>Apoyo</TableHead>
              <TableHead />
              <TableHead className="text-right">Rx</TableHead>
              <TableHead className="text-right">Rz</TableHead>
              <TableHead className="text-right">M</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...result.reactions].flatMap(([nodeId, envelope]) => {
              const name = nodes.find((n) => n.id === nodeId)?.name ?? nodeId;
              return (["max", "min"] as const).map((which) => (
                <TableRow key={`${nodeId}-${which}`}>
                  {which === "max" && <TableCell rowSpan={2}>{name}</TableCell>}
                  <TableCell className="text-muted-foreground">{which === "max" ? "máx" : "mín"}</TableCell>
                  {[0, 1, 2].map((i) => (
                    <TableCell
                      key={i}
                      className="text-right tabular-nums"
                      title={names.get(which === "max" ? envelope.maxBy[i] : envelope.minBy[i])}
                    >
                      {num(envelope[which][i], d)}
                      <span className="block text-xs text-muted-foreground">
                        {names.get(which === "max" ? envelope.maxBy[i] : envelope.minBy[i])}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

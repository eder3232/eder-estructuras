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
 * Una curva de la envolvente. **Se rotula poco**: con dos curvas por barra, un
 * número en cada extremo y en cada máximo se pisaban en todas las esquinas
 * (lo encontró mirar la app, paso 6). Se escriben los puntos —extremos de la
 * barra y su valor más grande— que llegan al menos a la mitad del máximo de la
 * curva; los demás están en la tabla de abajo.
 */
function envelopeCurve(points: EnvelopePoint[], quantity: Quantity, which: "max" | "min", length: number): MemberCurve {
  const value = (p: EnvelopePoint) => (which === "max" ? p.max[quantity] : p.min[quantity]);
  const top = extreme(points, quantity, which);
  const curve = points.map((p) => ({ x: p.x, value: value(p) }));
  // Constante en toda la barra (N de una columna): una vez, a mitad de la barra,
  // como en Pórticos 2D. En los extremos, el de una columna caía sobre el de la
  // de arriba (−32.28 sobre −13.56, medido).
  const big = Math.max(...curve.map((c) => Math.abs(c.value)));
  if (curve.every((c) => Math.abs(c.value - curve[0].value) <= 1e-9 * (1 + big))) {
    const keep = which === "max" ? curve[0].value > 0 : curve[0].value < 0;
    return { points: curve, labels: keep ? [{ x: length / 2, value: curve[0].value }] : [] };
  }
  const candidates = [
    { x: 0, value: value(points[0]) },
    { x: length, value: value(points[points.length - 1]) },
    ...(top.x > 1e-9 && top.x < length - 1e-9 ? [{ x: top.x, value: value(top) }] : []),
  ];
  const biggest = Math.max(...candidates.map((c) => Math.abs(c.value)));
  // Del lado equivocado (un «máximo» negativo) la curva no es la que manda: no se rotula.
  const labels = candidates.filter(
    (c) => Math.abs(c.value) >= 0.5 * biggest && (which === "max" ? c.value > 0 : c.value < 0),
  );
  return { points: curve, labels };
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
    curves.set(`${element.id}·max`, envelopeCurve(points, quantity, "max", length));
    curves.set(`${element.id}·min`, envelopeCurve(points, quantity, "min", length));
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

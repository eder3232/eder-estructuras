"use client";

import { useAtomValue } from "jotai";

import { useDecimals } from "@/components/custom/decimals-scope";
import { Math, MathBlock } from "@/components/custom/math";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atomLateralAnalysis } from "../store/analysis";
import { atomSeismicParams } from "../store/model";
import { atomSeismicForces } from "../store/seismic";
import { num } from "./format";

/** E.030, artículos 50 y 51: los desplazamientos «reales» y la distorsión de cada entrepiso. */
export function Drifts() {
  const lateral = useAtomValue(atomLateralAnalysis);
  const params = useAtomValue(atomSeismicParams);
  const forces = useAtomValue(atomSeismicForces);
  const d = useDecimals();

  if (lateral.status !== "ok") {
    return <p className="text-sm text-muted-foreground">Sin rigidez lateral no hay derivas (ver arriba).</p>;
  }

  const { drifts, levels, inelasticFactor, driftScale } = lateral;
  const failing = levels.filter((_, i) => !drifts[i].ok).map((l) => l.name);
  const scaled = driftScale !== 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-3xl flex-col gap-2 text-sm text-muted-foreground">
        <p>
          El análisis es elástico con fuerzas reducidas por <Math tex="R" />, así que sus desplazamientos se quedan
          cortos: para estimar los reales se multiplican por{" "}
          <Math tex={params.regular ? "0.75\\,R" : "0.85\\,R"} /> (artículo 50,{" "}
          {params.regular ? "estructura regular" : "estructura irregular"}). Después, la distorsión de cada
          entrepiso —lo que se movió respecto del piso de abajo, sobre su altura— no puede pasar el límite de la
          Tabla N° 14 (artículo 51).
        </p>
        <MathBlock
          tex={String.raw`\Delta_i = ${num(inelasticFactor, 2)}\,(\delta_i - \delta_{i-1}) \qquad \frac{\Delta_i}{h_{ei}} \le ${params.driftLimit}`}
        />
        {scaled && (
          <p>
            <strong>Mandó el mínimo de C/R</strong>: el cortante de diseño se calculó con 0.11, pero el artículo 50.3
            dice que los desplazamientos no lo usan. Por eso los del caso CS se escalan por{" "}
            <Math tex={String.raw`V_{\text{derivas}}/V = ${num(driftScale, d)}`} /> antes de multiplicar.
          </p>
        )}
      </div>

      <div className="max-w-full overflow-x-auto">
        <Table className="w-auto border">
          <TableHeader>
            <TableRow>
              <TableHead>Nivel</TableHead>
              <TableHead className="text-right">
                <Math tex="h_{ei}" />
              </TableHead>
              <TableHead className="text-right">
                <Math tex={String.raw`\delta_i`} /> elástico
              </TableHead>
              <TableHead className="text-right">
                <Math tex={String.raw`\delta_i \times ${num(inelasticFactor, 2)}`} />
              </TableHead>
              <TableHead className="text-right">
                <Math tex={String.raw`\Delta_i`} />
              </TableHead>
              <TableHead className="text-right">
                <Math tex={String.raw`\Delta_i / h_{ei}`} />
              </TableHead>
              <TableHead className="text-center">¿Cumple?</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {levels.map((level, i) => {
              const drift = drifts[i];
              return (
                <TableRow key={level.id}>
                  <TableCell>{level.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(drift.storyHeight, d)}</TableCell>
                  <TableCell className="text-right tabular-nums">{drift.elastic.toExponential(d)}</TableCell>
                  <TableCell className="text-right tabular-nums">{drift.inelastic.toExponential(d)}</TableCell>
                  <TableCell className="text-right tabular-nums">{drift.drift.toExponential(d)}</TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${drift.ok ? "" : "font-medium text-destructive"}`}
                  >
                    {/* Al menos 4 decimales: el límite es 0.007, y con 2 se leería 0.01 contra 0.01. */}
                    {drift.ratio.toFixed(d < 4 ? 4 : d)}
                  </TableCell>
                  <TableCell className={`text-center ${drift.ok ? "" : "font-medium text-destructive"}`}>
                    {drift.ok ? "Sí" : "No"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="max-w-3xl text-sm">
        {failing.length === 0 ? (
          <>
            <strong>Todos los entrepisos cumplen</strong> el límite de {params.driftLimit}.
          </>
        ) : (
          <>
            <strong className="text-destructive">
              {failing.length === 1 ? `${failing[0]} no cumple` : `${failing.join(", ")} no cumplen`}
            </strong>{" "}
            el límite de {params.driftLimit}: la estructura es demasiado flexible para ese sismo. La E.030 pide
            revisar la estructuración y repetir el análisis (Anexo I, paso 17): columnas o vigas más rígidas, o muros.
          </>
        )}
      </p>

      {lateral.rayleighPeriod !== null && forces.status === "ok" && forces.mode === "e030" && (
        <div className="flex max-w-3xl flex-col gap-2 text-sm text-muted-foreground">
          <p>
            <strong>El período, de nuevo</strong>. Con los desplazamientos de arriba el artículo 36.2 permite
            calcularlo con la estructura misma (Rayleigh), en vez de con la fórmula empírica:
          </p>
          <MathBlock
            tex={String.raw`T = 2\pi\sqrt{\frac{\sum P_i\,\delta_i^2}{g\,\sum F_i\,\delta_i}} = ${num(lateral.rayleighPeriod, d)}\ \text{s} \qquad \text{vs.} \qquad T = \frac{h_n}{C_T} = ${num(forces.T, d)}\ \text{s}`}
          />
          <p>
            La fórmula empírica supone un edificio con tabiques y losas que lo rigidizan; el pórtico desnudo es más
            flexible, así que su período suele dar mayor.{" "}
            {lateral.rayleighPeriod <= params.TP && forces.T <= params.TP ? (
              <>
                Acá los dos quedan por debajo de <Math tex={String.raw`T_P = ${num(params.TP, 2)}`} />, así que{" "}
                <Math tex="C" /> es 2.5 con cualquiera de los dos y el cortante no cambia.
              </>
            ) : (
              <>
                Acá <strong>cambia</strong> el <Math tex="C" />: si querés usar el de Rayleigh, escribilo como período
                en la sección del sismo.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

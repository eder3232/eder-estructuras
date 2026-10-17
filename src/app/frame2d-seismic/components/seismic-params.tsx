"use client";

import type { ReactNode } from "react";
import { useAtomValue, useSetAtom } from "jotai";

import { MIN_C_OVER_R } from "@/lib/engine";
import { useDecimals } from "@/components/custom/decimals-scope";
import { FormulaInput } from "@/components/custom/formula-input";
import { Math, MathBlock } from "@/components/custom/math";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { atomSeismicParams, atomUpdateSeismicParams, type SeismicParams } from "../store/model";
import { atomSeismicForces } from "../store/seismic";
import { num } from "./format";

type NumericParam = { [K in keyof SeismicParams]: SeismicParams[K] extends number ? K : never }[keyof SeismicParams];

function Field({ id, label, hint, children }: { id: string; label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function NumberField({ field, tex, hint }: { field: NumericParam; tex: string; hint?: string }) {
  const params = useAtomValue(atomSeismicParams);
  const update = useSetAtom(atomUpdateSeismicParams);
  const id = `seismic-${field}`;
  return (
    <Field id={id} label={<Math tex={tex} />} hint={hint}>
      <FormulaInput id={id} className="w-24" value={params[field]} onChange={(value) => update({ [field]: value })} />
    </Field>
  );
}

/**
 * Los datos de la E.030. La página **no los elige**: zona, suelo, uso y
 * sistema estructural se deciden con la norma en la mano, y la clasificación
 * del suelo cambió en 2026 (`docs/frame2d-seismic-v1.md`, sección 3).
 */
export function SeismicParamsForm() {
  const params = useAtomValue(atomSeismicParams);
  const update = useSetAtom(atomUpdateSeismicParams);
  const e030 = params.forceMode === "e030";

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Los parámetros los elegís vos con la <strong>E.030 (2026)</strong>: <Math tex="Z" /> por la zona (Tabla N° 1),{" "}
        <Math tex="S" />, <Math tex="T_P" /> y <Math tex="T_L" /> por el perfil de suelo (Tablas N° 4 y 5),{" "}
        <Math tex="U" /> por la categoría (Tabla N° 7) y <Math tex="R_0" /> por el sistema estructural (Tabla N° 10),
        con los factores de irregularidad <Math tex="I_a" /> e <Math tex="I_p" />. Para un pórtico de concreto
        armado regular, <Math tex="R_0 = 8" /> e <Math tex="I_a = I_p = 1" />.
      </p>

      <div className="flex flex-col gap-2">
        <Field id="seismic-force-mode" label="Fuerzas sísmicas">
          <Select
            value={params.forceMode}
            onValueChange={(value) => update({ forceMode: value as SeismicParams["forceMode"] })}
          >
            <SelectTrigger id="seismic-force-mode" className="w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="e030">Con la E.030 (estático)</SelectItem>
              <SelectItem value="manual">Escritas por nivel</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {e030 && (
        <div className="grid max-w-3xl grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-4">
          <NumberField field="Z" tex="Z" />
          <NumberField field="U" tex="U" />
          <NumberField field="S" tex="S" />
          <NumberField field="TP" tex="T_P\ (\text{s})" />
          <NumberField field="TL" tex="T_L\ (\text{s})" />
          <NumberField field="R0" tex="R_0" />
          <NumberField field="Ia" tex="I_a" />
          <NumberField field="Ip" tex="I_p" />
        </div>
      )}
      {!e030 && (
        <div className="grid max-w-3xl grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-4">
          <NumberField field="R0" tex="R_0" />
          <NumberField field="Ia" tex="I_a" />
          <NumberField field="Ip" tex="I_p" />
        </div>
      )}

      {e030 && (
        <div className="flex flex-wrap items-end gap-4">
          <Field id="seismic-period-mode" label="Período fundamental T">
            <Select
              value={params.periodMode}
              onValueChange={(value) => update({ periodMode: value as SeismicParams["periodMode"] })}
            >
              <SelectTrigger id="seismic-period-mode" className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="height">Por la altura (artículo 36.1)</SelectItem>
                <SelectItem value="manual">Escrito</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {params.periodMode === "height" ? (
            <NumberField field="CT" tex="C_T" hint="35 pórticos de concreto, 45, 60" />
          ) : (
            <NumberField field="T" tex="T\ (\text{s})" />
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="seismic-regular"
          checked={params.regular}
          onCheckedChange={(checked) => update({ regular: checked === true })}
        />
        <Label htmlFor="seismic-regular" className="font-normal normal-case">
          Estructura regular: los desplazamientos se multiplican por 0.75R (si no, por 0.85R; artículo 50)
        </Label>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <NumberField field="driftLimit" tex="(\Delta/h)_{\max}" hint="0.007 concreto armado (Tabla N° 14)" />
        <NumberField field="g" tex="g" hint="Para Rayleigh, en tus unidades" />
      </div>
    </div>
  );
}

/** El cálculo del cortante basal, renglón por renglón, con los números del modelo. */
export function SeismicSteps() {
  const forces = useAtomValue(atomSeismicForces);
  const params = useAtomValue(atomSeismicParams);
  const d = useDecimals();

  if (forces.status === "empty") {
    return (
      <p className="text-sm text-muted-foreground">
        No hay niveles: un nivel es una cota, por encima de la base, con algún nudo libre en x.
      </p>
    );
  }
  if (forces.status === "error") return <p className="text-sm text-destructive">{forces.message}</p>;
  if (forces.mode === "manual") {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p className="text-muted-foreground">
          Las fuerzas por nivel son las que escribiste en la tabla de niveles. <Math tex="R" /> se usa para las
          derivas:
        </p>
        <MathBlock
          tex={String.raw`R = R_0 \cdot I_a \cdot I_p = ${num(params.R0, 2)} \cdot ${num(params.Ia, 2)} \cdot ${num(params.Ip, 2)} = ${num(forces.R, 2)}`}
        />
      </div>
    );
  }

  const { detail, amplification, table, T, hn, R } = forces;
  const P = detail.weight;
  const cOverR = detail.cOverR;
  const shortBranch = table.branch === "short";

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">Artículo 26:</p>
      <MathBlock
        tex={String.raw`R = R_0 \cdot I_a \cdot I_p = ${num(params.R0, 2)} \cdot ${num(params.Ia, 2)} \cdot ${num(params.Ip, 2)} = ${num(R, 2)}`}
      />

      <p className="text-muted-foreground">
        {params.periodMode === "height" ? (
          <>
            Artículo 36.1, con <Math tex="h_n" /> la altura del nivel más alto:
          </>
        ) : (
          "El período escrito:"
        )}
      </p>
      <MathBlock
        tex={
          params.periodMode === "height"
            ? String.raw`T = \frac{h_n}{C_T} = \frac{${num(hn, d)}}{${num(params.CT, 0)}} = ${num(T, d)}\ \text{s}`
            : String.raw`T = ${num(T, d)}\ \text{s}`
        }
      />

      <p className="text-muted-foreground">
        Artículo 18:{" "}
        {T <= params.TP ? (
          <>
            como <Math tex={String.raw`T \le T_P = ${num(params.TP, 2)}`} />, para el análisis estático se usa{" "}
            <Math tex="C = 2.5" /> (18.3 y 34.1).
            {shortBranch && (
              <>
                {" "}
                La Tabla N° 6 daría{" "}
                <Math tex={String.raw`C = 1 + 7.5\,T/T_P = ${num(table.C, d)}`} /> —el tramo nuevo de 2026—, pero
                ese no se usa para el cortante estático.
              </>
            )}
          </>
        ) : (
          <>Tabla N° 6.</>
        )}
      </p>
      {T > params.TP && (
        <MathBlock
          tex={
            amplification.branch === "descending"
              ? String.raw`C = 2.5 \cdot \frac{T_P}{T} = 2.5 \cdot \frac{${num(params.TP, 2)}}{${num(T, d)}} = ${num(amplification.C, d)}`
              : String.raw`C = 2.5 \cdot \frac{T_P \cdot T_L}{T^2} = 2.5 \cdot \frac{${num(params.TP, 2)} \cdot ${num(params.TL, 2)}}{${num(T, d)}^2} = ${num(amplification.C, d)}`
          }
        />
      )}

      <p className="text-muted-foreground">Artículo 34.2:</p>
      <MathBlock
        tex={
          detail.minimumGoverns
            ? String.raw`\frac{C}{R} = \frac{${num(amplification.C, d)}}{${num(R, 2)}} = ${num(cOverR, d)} < ${MIN_C_OVER_R}\ \Rightarrow\ \text{se usa } ${MIN_C_OVER_R}`
            : String.raw`\frac{C}{R} = \frac{${num(amplification.C, d)}}{${num(R, 2)}} = ${num(cOverR, d)} \ge ${MIN_C_OVER_R}`
        }
      />

      <p className="text-muted-foreground">
        El peso <Math tex={String.raw`P = \sum P_i`} /> (artículo 31) y el cortante en la base (artículo 34.1):
      </p>
      <MathBlock
        tex={
          // Si manda el mínimo, sin «C»: poner ahí 0.11·R se leía como el C del suelo.
          detail.minimumGoverns
            ? String.raw`V = Z \cdot U \cdot S \cdot \left(\frac{C}{R}\right)_{\min} \cdot P = ${num(params.Z, 2)} \cdot ${num(params.U, 2)} \cdot ${num(params.S, 2)} \cdot ${MIN_C_OVER_R} \cdot ${num(P, d)} = ${num(detail.baseShear, d)}`
            : String.raw`V = \frac{Z \cdot U \cdot C \cdot S}{R} \cdot P = \frac{${num(params.Z, 2)} \cdot ${num(params.U, 2)} \cdot ${num(amplification.C, d)} \cdot ${num(params.S, 2)}}{${num(R, 2)}} \cdot ${num(P, d)} = ${num(detail.baseShear, d)}`
        }
      />
      {detail.minimumGoverns && (
        <>
          <p className="text-muted-foreground">
            Como mandó el mínimo, <strong>las derivas usan el cortante sin él</strong> (artículo 50.3):
          </p>
          <MathBlock
            tex={String.raw`V_{\text{derivas}} = Z \cdot U \cdot S \cdot \frac{C}{R} \cdot P = ${num(detail.driftBaseShear, d)}`}
          />
        </>
      )}

      <p className="text-muted-foreground">Artículo 35.2:</p>
      <MathBlock
        tex={
          T <= 0.5
            ? String.raw`T = ${num(T, d)} \le 0.5\ \text{s} \Rightarrow k = 1`
            : String.raw`T > 0.5\ \text{s} \Rightarrow k = 0.75 + 0.5\,T = ${num(0.75 + 0.5 * T, d)}${detail.k === 2 ? String.raw` \to 2` : ""}`
        }
      />
      <p className="text-muted-foreground">
        Y cada nivel se lleva <Math tex={String.raw`F_i = \alpha_i \cdot V`} />, con{" "}
        <Math tex={String.raw`\alpha_i = P_i\,h_i^{\,k} \big/ \sum_j P_j\,h_j^{\,k}`} />: la tabla de niveles.
      </p>
    </div>
  );
}

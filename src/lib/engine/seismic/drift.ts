/**
 * E.030, artículos 50 y 51: los desplazamientos laterales «reales» y la
 * distorsión de cada entrepiso.
 *
 * El análisis es elástico con fuerzas reducidas por R, así que sus
 * desplazamientos se quedan cortos: se multiplican por 0.75R (regular) o
 * 0.85R (irregular), ver `inelasticFactor`. **Con las fuerzas sin el mínimo
 * de C/R** (50.3).
 */

/** E.030, Tabla N° 14: el límite de Δᵢ/hₑᵢ según el material predominante. */
export const DRIFT_LIMITS = {
  concrete: 0.007,
  steel: 0.01,
  masonry: 0.005,
  wood: 0.01,
  limitedDuctilityWalls: 0.004,
} as const;

export interface DriftInput {
  /** hᵢ de cada nivel desde la base, **de abajo hacia arriba**. */
  heights: number[];
  /** El desplazamiento lateral elástico de cada nivel, en el mismo orden. */
  displacements: number[];
  /** 0.75R o 0.85R. */
  factor: number;
  /** Δᵢ/hₑᵢ admisible. */
  limit: number;
}

export interface StoryDrift {
  /** hₑᵢ, la altura del entrepiso. */
  storyHeight: number;
  elastic: number;
  /** El desplazamiento del nivel × el factor. */
  inelastic: number;
  /** Δᵢ: el inelástico de este nivel menos el del de abajo. */
  drift: number;
  /** Δᵢ/hₑᵢ. */
  ratio: number;
  ok: boolean;
}

export function storyDrifts({ heights, displacements, factor, limit }: DriftInput): StoryDrift[] {
  if (heights.length !== displacements.length) {
    throw new Error("Hace falta un desplazamiento por nivel.");
  }
  heights.forEach((h, i) => {
    if (!(h > (heights[i - 1] ?? 0))) throw new Error("Los niveles tienen que ir de abajo hacia arriba, con alturas crecientes desde la base.");
  });

  return heights.map((height, i) => {
    const storyHeight = height - (heights[i - 1] ?? 0);
    const inelastic = displacements[i] * factor;
    const below = (displacements[i - 1] ?? 0) * factor;
    const drift = inelastic - below;
    const ratio = Math.abs(drift) / storyHeight;
    return { storyHeight, elastic: displacements[i], inelastic, drift, ratio, ok: ratio <= limit };
  });
}

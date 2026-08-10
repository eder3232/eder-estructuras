import { ForceArrow } from "./force-arrow";
import { MomentArc } from "./moment-arc";
import type { DiagramForce } from "./types";

interface ForceGlyphProps {
  force: DiagramForce;
  unitSize: number;
  variant: "force" | "reaction";
}

/**
 * Punto único de decisión entre flecha recta (traslación) y arco (rotación),
 * para que los diagramas no repitan el `if` por eje. Los sistemas sin DOF
 * rotacional nunca producen un `axis: "r"` y por lo tanto nunca ven el arco.
 */
export function ForceGlyph({ force, unitSize, variant }: ForceGlyphProps) {
  if (force.axis === "r") {
    return <MomentArc x={force.x} z={force.z} value={force.value} unitSize={unitSize} variant={variant} />;
  }

  return (
    <ForceArrow
      x={force.x}
      z={force.z}
      axis={force.axis}
      value={force.value}
      unitSize={unitSize}
      variant={variant}
    />
  );
}

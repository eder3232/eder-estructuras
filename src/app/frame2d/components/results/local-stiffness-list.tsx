import { FrameElement2D } from "@/lib/engine";
import { MatrixTable } from "@/components/custom/matrix-table";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";

interface LocalStiffnessListProps {
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
}

/**
 * A diferencia de una barra de armadura, acá la rigidez local no es solo axial:
 * combina EA/L (axial) con los términos de flexión, que dependen de la inercia.
 * Los escalares se recalculan acá solo para mostrarlos en la narrativa; las
 * matrices salen de `FrameElement2D`, la misma clase que usa `System`, para no
 * reimplementar el álgebra.
 */
export function LocalStiffnessList({ elements, nodesById }: LocalStiffnessListProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Cada barra aporta una rigidez local de 6×6 en el orden [u, w, θ] por extremo: el término axial EA/L queda
        desacoplado de los de flexión (12EI/L³, 6EI/L², 4EI/L, 2EI/L). Se lleva a ejes globales con Tᵀ·k·T, donde T
        rota las traslaciones según el ángulo de la barra y deja la rotación intacta.
      </p>
      <div className="flex flex-col gap-8">
        {elements.map((element) => {
          const from = nodesById.get(element.fromNodeId);
          const to = nodesById.get(element.toNodeId);
          if (!from || !to) return null;

          const dx = to.x - from.x;
          const dz = to.z - from.z;
          const length = Math.hypot(dx, dz);
          if (length === 0) return null;

          const cos = dx / length;
          const sin = dz / length;
          const eaOverL = (element.elasticity * element.area) / length;
          const ei = element.elasticity * element.inertia;

          const frameElement = new FrameElement2D(
            element.id,
            { id: from.id, x: from.x, z: from.z },
            { id: to.id, x: to.x, z: to.z },
            element.area,
            element.elasticity,
            element.inertia,
          );

          const localLabels = [
            `${from.name}u`,
            `${from.name}w`,
            `${from.name}θ`,
            `${to.name}u`,
            `${to.name}w`,
            `${to.name}θ`,
          ];
          const globalLabels = [
            `${from.name}x`,
            `${from.name}z`,
            `${from.name}θ`,
            `${to.name}x`,
            `${to.name}z`,
            `${to.name}θ`,
          ];

          return (
            <div key={element.id} className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                {element.name} ({from.name}↔{to.name}): L={length.toFixed(4)}, cos={cos.toFixed(4)}, sin=
                {sin.toFixed(4)}, EA/L={eaOverL.toFixed(4)}, 12EI/L³={((12 * ei) / length ** 3).toFixed(4)}, 6EI/L²=
                {((6 * ei) / length ** 2).toFixed(4)}, 4EI/L={((4 * ei) / length).toFixed(4)}
              </p>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">Rigidez local (ejes de la barra)</p>
                  <MatrixTable matrix={frameElement.localStiffness()} labels={localLabels} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">Rigidez global (Tᵀ·k·T)</p>
                  <MatrixTable matrix={frameElement.stiffness()} labels={globalLabels} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

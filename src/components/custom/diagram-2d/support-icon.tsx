import { projectPoint } from "./viewbox";

interface SupportIconProps {
  x: number;
  z: number;
  restrainedX: boolean;
  restrainedZ: boolean;
  unitSize: number;
}

/**
 * Glifo apuntando hacia abajo por defecto (apoyo "debajo" del nudo). Si solo
 * un eje está restringido se rota 90° para que el apoyo quede del lado que
 * restringe (restrainedX solo → apoyo al costado, restringe horizontal).
 * Con ambos ejes restringidos (apoyo articulado/pin de una armadura, no hay
 * DOF rotacional en este sistema) se dibuja el triángulo con achurado de
 * suelo; con uno solo (rodillo) se dibujan círculos en vez de achurado.
 */
export function SupportIcon({ x, z, restrainedX, restrainedZ, unitSize }: SupportIconProps) {
  if (!restrainedX && !restrainedZ) return null;

  const { x: cx, y: cy } = projectPoint({ x, z });
  const isPinned = restrainedX && restrainedZ;
  const rotation = !restrainedZ && restrainedX ? 90 : 0;

  const half = unitSize * 0.6;
  const triangleHeight = unitSize * 1.6;

  return (
    <g
      transform={`translate(${cx} ${cy}) rotate(${rotation})`}
      className="fill-muted-foreground stroke-muted-foreground"
      vectorEffect="non-scaling-stroke"
    >
      <polygon
        points={`0,0 ${-half},${triangleHeight} ${half},${triangleHeight}`}
        className="fill-background"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {isPinned ? (
        <g strokeWidth={1.5} vectorEffect="non-scaling-stroke">
          <line x1={-half * 1.3} y1={triangleHeight} x2={half * 1.3} y2={triangleHeight} />
          {[-1, -0.5, 0, 0.5, 1].map((t) => (
            <line
              key={t}
              x1={t * half * 1.3}
              y1={triangleHeight}
              x2={t * half * 1.3 - half * 0.35}
              y2={triangleHeight + half * 0.5}
            />
          ))}
        </g>
      ) : (
        [-0.65, 0, 0.65].map((t) => (
          <circle
            key={t}
            cx={t * half}
            cy={triangleHeight + half * 0.25}
            r={half * 0.25}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))
      )}
    </g>
  );
}

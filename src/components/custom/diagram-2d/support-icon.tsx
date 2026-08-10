import { projectPoint } from "./viewbox";

interface SupportIconProps {
  x: number;
  z: number;
  restrainedX: boolean;
  restrainedZ: boolean;
  /** Solo lo pasan los sistemas con DOF rotacional (pórticos). */
  restrainedRotation?: boolean;
  unitSize: number;
}

/**
 * Achurado de suelo: la línea de base más las rayitas inclinadas.
 *
 * Cada línea declara su propio `vectorEffect`: no es una propiedad heredable,
 * así que ponerlo en el `<g>` no alcanza. `strokeWidth` sí hereda, y sin el
 * efecto se interpreta en unidades del modelo — a esta escala, un trazo de 1.5
 * tapaba el glifo entero.
 */
function Ground({ half, y }: { half: number; y: number }) {
  return (
    <g>
      <line x1={-half} y1={y} x2={half} y2={y} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {[-1, -0.5, 0, 0.5, 1].map((t) => (
        <line
          key={t}
          x1={t * half}
          y1={y}
          x2={t * half - half * 0.5}
          y2={y + half * 0.7}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

/**
 * Glifo apuntando hacia abajo por defecto (apoyo "debajo" del nudo). Si solo
 * un eje de traslación está restringido se rota 90° para que el apoyo quede
 * del lado que restringe.
 *
 * Tres notaciones, según qué DOF están impedidos:
 * - Empotramiento (ambas traslaciones + giro): muro achurado pegado al nudo —
 *   el triángulo se reserva para los apoyos que sí dejan girar.
 * - Articulado/pin (ambas traslaciones, giro libre): triángulo con achurado.
 * - Rodillo (una traslación): triángulo con círculos.
 * Un giro impedido sin ambas traslaciones (apoyo guiado, poco común) se marca
 * con un cuadrado sobre el nudo para no dibujar un empotramiento que no es.
 */
export function SupportIcon({
  x,
  z,
  restrainedX,
  restrainedZ,
  restrainedRotation = false,
  unitSize,
}: SupportIconProps) {
  if (!restrainedX && !restrainedZ && !restrainedRotation) return null;

  const { x: cx, y: cy } = projectPoint({ x, z });
  const bothTranslations = restrainedX && restrainedZ;
  const isFixed = bothTranslations && restrainedRotation;
  const rotation = !restrainedZ && restrainedX ? 90 : 0;

  const half = unitSize * 0.6;
  const triangleHeight = unitSize * 1.6;

  return (
    <g
      transform={`translate(${cx} ${cy}) rotate(${rotation})`}
      className="fill-muted-foreground stroke-muted-foreground"
    >
      {isFixed ? (
        <Ground half={half * 1.8} y={0} />
      ) : (
        <>
          <polygon
            points={`0,0 ${-half},${triangleHeight} ${half},${triangleHeight}`}
            className="fill-background"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          {bothTranslations ? (
            <Ground half={half * 1.3} y={triangleHeight} />
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
          {restrainedRotation && (
            <rect
              x={-half * 0.35}
              y={-half * 0.7}
              width={half * 0.7}
              height={half * 0.7}
              className="fill-background"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </>
      )}
    </g>
  );
}

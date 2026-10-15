"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import type { PerspectiveCamera } from "three";

import { Button } from "@/components/ui/button";
import { computeBounds, computeUnitSize, type Bounds3D } from "./bounds";
import { useDiagramColors } from "./theme-colors";
import type { Point3 } from "./types";

type OrbitControlsRef = React.ComponentRef<typeof OrbitControls>;

/** Dirección de la vista inicial: desde +x, −y y arriba — la isométrica de siempre. */
const VIEW_DIRECTION: Point3 = [0.85, -1, 0.6];

function cameraPositionFor(bounds: Bounds3D): Point3 {
  const norm = Math.hypot(...VIEW_DIRECTION);
  const distance = bounds.radius * 3.2;
  return [
    bounds.center[0] + (VIEW_DIRECTION[0] / norm) * distance,
    bounds.center[1] + (VIEW_DIRECTION[1] / norm) * distance,
    bounds.center[2] + (VIEW_DIRECTION[2] / norm) * distance,
  ];
}

interface SceneCanvasProps {
  /** Todos los puntos que la vista tiene que abarcar (nudos, y en la deformada también los desplazados). */
  points: Point3[];
  children: ReactNode;
  className?: string;
}

/**
 * Contenedor de escena: cámara, luces, piso de referencia y órbita con el
 * mouse. Es el equivalente 3D de `svg-canvas.tsx`, y como aquel no sabe nada
 * de qué es un elemento estructural — solo recibe los puntos a encuadrar.
 *
 * La cámara se encuadra **una sola vez**, al montar: reencuadrar en cada cambio
 * de datos movería la vista mientras el usuario edita una tabla. El botón
 * "Recentrar" recupera el encuadre cuando hizo falta.
 */
export function SceneCanvas({ points, children, className }: SceneCanvasProps) {
  const bounds = useMemo(() => computeBounds(points), [points]);
  const unitSize = computeUnitSize(bounds);
  const colors = useDiagramColors();

  const controlsRef = useRef<OrbitControlsRef>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);

  // El encuadre inicial se congela al montar (estado inicial perezoso, no un
  // ref: esto sí se lee en render). `bounds` sigue vivo para "Recentrar", que
  // usa siempre los datos actuales.
  const [initialFraming] = useState(() => ({
    position: cameraPositionFor(bounds),
    target: bounds.center,
  }));

  const recenter = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(...cameraPositionFor(bounds));
    controls.target.set(bounds.center[0], bounds.center[1], bounds.center[2]);
    controls.update();
  }, [bounds]);

  const gridSize = Math.max(bounds.extent * 2.5, 1);
  const groundZ = bounds.min[2];

  return (
    <div className={className ?? "relative h-[28rem] w-full overflow-hidden rounded-lg border bg-muted/20"}>
      <Canvas
        camera={{
          position: initialFraming.position,
          // z arriba: las coordenadas estructurales entran a la escena sin remapear ejes.
          up: [0, 0, 1],
          fov: 45,
          near: bounds.radius / 100,
          far: bounds.radius * 100,
        }}
        onCreated={({ camera }) => {
          cameraRef.current = camera as PerspectiveCamera;
          camera.lookAt(initialFraming.target[0], initialFraming.target[1], initialFraming.target[2]);
        }}
      >
        <ambientLight intensity={1.4} />
        <directionalLight position={initialFraming.position} intensity={2} />

        {/* Piso de referencia en el plano xy, a la altura del nudo más bajo. */}
        <gridHelper
          args={[gridSize, 12, colors.mutedForeground, colors.border]}
          rotation={[Math.PI / 2, 0, 0]}
          position={[bounds.center[0], bounds.center[1], groundZ]}
        />

        <AxesTriad origin={[bounds.min[0], bounds.min[1], groundZ]} length={unitSize * 10} />

        {children}

        <OrbitControls ref={controlsRef} target={initialFraming.target} makeDefault enableDamping />
      </Canvas>

      <Button size="sm" variant="outline" className="absolute right-2 top-2" onClick={recenter}>
        Recentrar
      </Button>
      <p className="absolute bottom-2 left-2 text-xs text-muted-foreground">
        Arrastrá para rotar · rueda para acercar · click derecho para desplazar
      </p>
    </div>
  );
}

/**
 * Terna de ejes con etiqueta. En 3D no alcanza con que el dibujo esté a escala:
 * sin una referencia de orientación no se sabe hacia dónde mira la figura
 * después de rotarla.
 */
function AxesTriad({ origin, length }: { origin: Point3; length: number }) {
  const axes: { axis: string; direction: Point3; color: string }[] = [
    { axis: "x", direction: [1, 0, 0], color: "#ef4444" },
    { axis: "y", direction: [0, 1, 0], color: "#22c55e" },
    { axis: "z", direction: [0, 0, 1], color: "#3b82f6" },
  ];

  return (
    <group position={origin}>
      {axes.map(({ axis, direction, color }) => (
        <group key={axis}>
          <mesh
            position={[
              (direction[0] * length) / 2,
              (direction[1] * length) / 2,
              (direction[2] * length) / 2,
            ]}
            rotation={axis === "x" ? [0, 0, -Math.PI / 2] : axis === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
          >
            <cylinderGeometry args={[length * 0.02, length * 0.02, length, 8]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <Html
            position={[direction[0] * length * 1.15, direction[1] * length * 1.15, direction[2] * length * 1.15]}
            center
            style={{ pointerEvents: "none" }}
          >
            <span className="text-[10px] font-medium" style={{ color }}>
              {axis}
            </span>
          </Html>
        </group>
      ))}
    </group>
  );
}

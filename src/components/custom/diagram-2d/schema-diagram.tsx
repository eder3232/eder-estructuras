import { axialLabelPoint } from "./axial-label";
import { computeUnitSize } from "./unit-scale";
import { DiagramLabel } from "./diagram-label";
import { ForceGlyph } from "./force-glyph";
import { MemberLoadGlyph, memberLoadSide } from "./member-load-glyph";
import { DiagramScaleProvider } from "./scale-context";
import { SupportIcon } from "./support-icon";
import type { DiagramElement, DiagramForce, DiagramMemberLoad, DiagramNode, DiagramSupport } from "./types";
import { computeViewBox, projectPoint } from "./viewbox";
import { SvgCanvas } from "./svg-canvas";

interface SchemaDiagramProps {
  nodes: DiagramNode[];
  elements: DiagramElement[];
  supports: DiagramSupport[];
  forces: DiagramForce[];
  /** Cargas a lo largo de las barras: solo `/frame2d` las tiene. */
  memberLoads?: DiagramMemberLoad[];
  /**
   * Qué señalar. Cuando hay algo señalado **el resto se apaga**, que es lo que
   * hace que se lea: resaltar sin atenuar deja la figura igual de cargada y hay
   * que buscar la barra con la vista.
   */
  highlight?: { nodeIds: string[]; elementIds: string[] } | null;
  /**
   * La otra mitad de **N3**: señalar *desde* el dibujo, para que se encienda la
   * fila de la tabla. Es opcional a propósito — los tres sistemas que no lo
   * pasan siguen exactamente igual, y el diagrama chico de la sección 2 no debe
   * pasarlo: ahí quien manda es la celda de `K` y el mouse está en la matriz.
   */
  onHighlight?: (highlight: { nodeIds: string[]; elementIds: string[] } | null) => void;
  /** Para achicarlo: al lado de una matriz no entra un lienzo de 500 px. */
  className?: string;
}

export function SchemaDiagram({
  nodes,
  elements,
  supports,
  forces,
  memberLoads = [],
  highlight,
  onHighlight,
  className,
}: SchemaDiagramProps) {
  if (nodes.length === 0) return null;

  /**
   * Lo señalado se queda como está y **el resto se apaga**. Resaltar sin
   * atenuar deja la figura igual de cargada y hay que buscar la barra con la
   * vista.
   *
   * **El engrosado va solo a las `line`**, y no es un detalle de estilo: un
   * `stroke` sobre el `circle` de un nudo se dibuja en unidades del modelo, no
   * en píxeles —los nudos no llevan `vector-effect`, nunca tuvieron trazo— así
   * que sale un círculo enorme. Es la misma trampa que ya costó una vez con los
   * apoyos, y otra vez la encontró la captura y no el markup.
   */
  const dim = (id: string, kind: "node" | "element") => {
    if (!highlight) return undefined;
    const señalado = kind === "node" ? highlight.nodeIds.includes(id) : highlight.elementIds.includes(id);
    if (!señalado) return "opacity-20";
    return kind === "element" ? "[&_line]:stroke-primary [&_line]:stroke-[3]" : undefined;
  };

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const points = nodes.map((n) => projectPoint(n));
  const viewBox = computeViewBox(points);
  const unitSize = computeUnitSize(viewBox);
  const nodeRadius = unitSize * 0.35;

  // Las cajas de los textos, estimadas (la fuente mide `unitSize`, y con el
  // halo ocupa algo más de un renglón): solo para que el nombre de una barra no
  // caiga sobre el de un nudo ni sobre el número de una fuerza.
  const CHAR_WIDTH = 0.62;
  const HALF = 0.65;
  const box = (left: number, width: number, y: number) => ({ left, right: left + width, top: y - unitSize * HALF, bottom: y + unitSize * HALF });
  const textWidth = (text: string) => text.length * CHAR_WIDTH * unitSize;
  const occupiedBoxes = [
    ...nodes.map((node) => {
      const { x, y } = projectPoint(node);
      // El nombre del nudo va arriba a la derecha, con la base del texto ahí.
      return box(x + nodeRadius * 1.6, textWidth(node.name), y - nodeRadius * 1.6 - unitSize * 0.4);
    }),
    // El número de una fuerza, donde lo pone `ForceArrow`.
    ...forces
      .filter((f) => f.axis !== "r" && f.value !== 0)
      .map((f) => {
        const { x, y } = projectPoint(f);
        const width = textWidth(f.value.toFixed(4));
        if (f.axis === "x") {
          const dir = f.value > 0 ? 1 : -1;
          const tip = x + dir * unitSize * (2.2 + 0.55);
          return box(dir > 0 ? tip : tip - width, width, y + unitSize * 0.6);
        }
        const tipY = y + (f.value > 0 ? -1 : 1) * unitSize * 2.2;
        return box(x + unitSize * 0.55, width, tipY);
      }),
  ];
  const labelBox = ({ x, y, anchor }: { x: number; y: number; anchor: "start" | "middle" | "end" }, text: string) => {
    const width = textWidth(text);
    return box(anchor === "start" ? x : anchor === "end" ? x - width : x - width / 2, width, y);
  };
  const overlaps = (p: ReturnType<typeof box>, q: ReturnType<typeof box>) =>
    p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
  const center = { x: viewBox.minX + viewBox.width / 2, y: viewBox.minY + viewBox.height / 2 };

  return (
    <DiagramScaleProvider values={[...forces.map((f) => f.value), ...memberLoads.flatMap((l) => [l.q1, l.q2])]}>
      <SvgCanvas viewBox={viewBox} className={className}>
        <g className="stroke-foreground" strokeWidth={1.5}>
          {elements.map((element) => {
            const from = nodesById.get(element.fromNodeId);
            const to = nodesById.get(element.toNodeId);
            if (!from || !to) return null;
            const a = projectPoint(from);
            const b = projectPoint(to);
            // El nombre de la barra sigue **la misma regla que el valor axial**
            // de la forma deformada: al 25% del recorrido y corrido hacia
            // afuera de la figura. Antes usaba un corrimiento fijo hacia
            // arriba, que es justo la regla que D6 descartó — y se vio en el
            // ejemplo de la cercha, donde el nombre de la diagonal quedaba
            // escrito encima del valor de la carga del nudo.
            // Y si la barra tiene una carga dibujada, del lado contrario a sus flechas.
            const occupied = memberLoads
              .filter((l) => l.elementId === element.id)
              .map((l) => memberLoadSide(l, from, to))
              .find((side) => side !== null);
            // Al 25%, salvo que ahí choque con el nombre de un nudo: entonces al
            // 50% o al 75%. En un pórtico de dos vanos el nombre de cada columna
            // interior caía sobre el del nudo de abajo (D17, medido en el ejemplo
            // de tres pisos de `frame2d-seismic`). Donde no hay choque no cambia nada.
            const { x, y, anchor } =
              [0.25, 0.5, 0.75]
                .map((at) => axialLabelPoint(a, b, unitSize, center, occupied ?? undefined, at))
                .find((placement) => !occupiedBoxes.some((taken) => overlaps(taken, labelBox(placement, element.name))))
              ?? axialLabelPoint(a, b, unitSize, center, occupied ?? undefined);
            return (
              <g key={element.id} className={dim(element.id, "element")}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />
                <DiagramLabel x={x} y={y} unitSize={unitSize} anchor={anchor} className="fill-foreground">
                  {element.name}
                </DiagramLabel>
              </g>
            );
          })}
        </g>

        {nodes.map((node) => {
          const { x, y } = projectPoint(node);
          return (
            <g key={node.id} className={dim(node.id, "node")}>
              <circle cx={x} cy={y} r={nodeRadius} className="fill-primary" />
              <DiagramLabel
                x={x + nodeRadius * 1.6}
                y={y - nodeRadius * 1.6}
                unitSize={unitSize}
                anchor="start"
                baseline="auto"
                // `primary` mide 2.79:1 contra el fondo en oscuro: sirve para
                // el círculo, no para un texto (WCAG pide 4.5). `green-500` es
                // el mismo tono, más claro (8.9:1).
                className="fill-primary dark:fill-green-500"
              >
                {node.name}
              </DiagramLabel>
            </g>
          );
        })}

        {/* Apoyos y fuerzas se apagan **con su nudo**: son de él, no del
            dibujo en general. Lo encontró la captura — con las flechas a plena
            intensidad sobre una figura al 20%, lo más fuerte de la pantalla
            pasaba a ser justo lo que no se estaba señalando. */}
        {supports.map((support) => (
          <g key={support.nodeId} className={dim(support.nodeId, "node")}>
            <SupportIcon
              x={support.x}
              z={support.z}
              restrainedX={support.restrainedX}
              restrainedZ={support.restrainedZ}
              restrainedRotation={support.restrainedRotation}
              unitSize={unitSize}
            />
          </g>
        ))}

        {/* Se apagan con su barra, por la misma razón que las fuerzas con su
            nudo — pero solo la opacidad: el engrosado de `dim()` pintaría las
            flechas de la carga con el color de la barra señalada. */}
        {memberLoads.map((load) => {
          const element = elements.find((e) => e.id === load.elementId);
          const from = element && nodesById.get(element.fromNodeId);
          const to = element && nodesById.get(element.toNodeId);
          if (!from || !to) return null;
          const off = highlight && !highlight.elementIds.includes(load.elementId);
          return (
            <g key={load.id} className={off ? "opacity-20" : undefined}>
              <MemberLoadGlyph load={load} from={from} to={to} unitSize={unitSize} />
            </g>
          );
        })}

        {forces.map((force, i) => (
          <g key={`${force.nodeId}-${force.axis}-${i}`} className={dim(force.nodeId, "node")}>
            <ForceGlyph force={force} unitSize={unitSize} variant="force" />
          </g>
        ))}

        {/*
          Las zonas sensibles al mouse van **en una capa aparte y al final**, no
          sobre las formas que ya están dibujadas, por dos razones. Una es que
          una barra mide un píxel y medio de ancho: cazarla con el mouse a esa
          escala es imposible, así que hace falta una línea invisible mucho más
          gruesa —en píxeles, con `non-scaling-stroke`, que es la trampa de este
          módulo—. La otra es que las clases de resaltado de `dim()` bajan a
          todos los `line` descendientes de una barra señalada, y le pintarían
          también el área de captura.

          Los nudos van después de las barras: en un encuentro, el que gana el
          mouse tiene que ser el nudo, que es el más chico de los dos.
        */}
        {onHighlight && (
          <g className="cursor-pointer">
            {elements.map((element) => {
              const from = nodesById.get(element.fromNodeId);
              const to = nodesById.get(element.toNodeId);
              if (!from || !to) return null;
              const a = projectPoint(from);
              const b = projectPoint(to);
              return (
                <line
                  key={element.id}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className="stroke-transparent"
                  strokeWidth={14}
                  vectorEffect="non-scaling-stroke"
                  aria-label={`Barra ${element.name}`}
                  onMouseEnter={() =>
                    onHighlight({
                      nodeIds: [element.fromNodeId, element.toNodeId],
                      elementIds: [element.id],
                    })
                  }
                  onMouseLeave={() => onHighlight(null)}
                />
              );
            })}
            {nodes.map((node) => {
              const { x, y } = projectPoint(node);
              return (
                <circle
                  key={node.id}
                  cx={x}
                  cy={y}
                  r={nodeRadius * 2.2}
                  className="fill-transparent"
                  aria-label={`Nudo ${node.name}`}
                  onMouseEnter={() => onHighlight({ nodeIds: [node.id], elementIds: [] })}
                  onMouseLeave={() => onHighlight(null)}
                />
              );
            })}
          </g>
        )}
      </SvgCanvas>
    </DiagramScaleProvider>
  );
}

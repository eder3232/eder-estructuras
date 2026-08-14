import { axialLabelPoint } from "./axial-label";
import { computeUnitSize } from "./unit-scale";
import { DiagramLabel } from "./diagram-label";
import { ForceGlyph } from "./force-glyph";
import { DiagramScaleProvider } from "./scale-context";
import { SupportIcon } from "./support-icon";
import type { DiagramElement, DiagramForce, DiagramNode, DiagramSupport } from "./types";
import { computeViewBox, projectPoint } from "./viewbox";
import { SvgCanvas } from "./svg-canvas";

interface SchemaDiagramProps {
  nodes: DiagramNode[];
  elements: DiagramElement[];
  supports: DiagramSupport[];
  forces: DiagramForce[];
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
  const center = { x: viewBox.minX + viewBox.width / 2, y: viewBox.minY + viewBox.height / 2 };

  return (
    <DiagramScaleProvider values={forces.map((f) => f.value)}>
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
            const { x, y, anchor } = axialLabelPoint(a, b, unitSize, center);
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
                className="fill-primary"
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

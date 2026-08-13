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
  /** Para achicarlo: al lado de una matriz no entra un lienzo de 500 px. */
  className?: string;
}

export function SchemaDiagram({ nodes, elements, supports, forces, highlight, className }: SchemaDiagramProps) {
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
            const labelX = a.x + 0.25 * (b.x - a.x);
            const labelY = a.y + 0.25 * (b.y - a.y);
            return (
              <g key={element.id} className={dim(element.id, "element")}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />
                <DiagramLabel
                  x={labelX}
                  y={labelY - unitSize * 0.4}
                  unitSize={unitSize}
                  baseline="auto"
                  className="fill-foreground"
                >
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

        {supports.map((support) => (
          <SupportIcon
            key={support.nodeId}
            x={support.x}
            z={support.z}
            restrainedX={support.restrainedX}
            restrainedZ={support.restrainedZ}
            restrainedRotation={support.restrainedRotation}
            unitSize={unitSize}
          />
        ))}

        {forces.map((force, i) => (
          <ForceGlyph key={`${force.nodeId}-${force.axis}-${i}`} force={force} unitSize={unitSize} variant="force" />
        ))}
      </SvgCanvas>
    </DiagramScaleProvider>
  );
}

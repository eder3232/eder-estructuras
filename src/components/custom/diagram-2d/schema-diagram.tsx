import { computeUnitSize } from "./unit-scale";
import { ForceArrow } from "./force-arrow";
import { SupportIcon } from "./support-icon";
import type { DiagramElement, DiagramForce, DiagramNode, DiagramSupport } from "./types";
import { computeViewBox, projectPoint } from "./viewbox";
import { SvgCanvas } from "./svg-canvas";

interface SchemaDiagramProps {
  nodes: DiagramNode[];
  elements: DiagramElement[];
  supports: DiagramSupport[];
  forces: DiagramForce[];
}

export function SchemaDiagram({ nodes, elements, supports, forces }: SchemaDiagramProps) {
  if (nodes.length === 0) return null;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const points = nodes.map((n) => projectPoint(n));
  const viewBox = computeViewBox(points);
  const unitSize = computeUnitSize(viewBox);
  const nodeRadius = unitSize * 0.35;

  return (
    <SvgCanvas viewBox={viewBox}>
      <g className="stroke-foreground" strokeWidth={1.5} vectorEffect="non-scaling-stroke">
        {elements.map((element) => {
          const from = nodesById.get(element.fromNodeId);
          const to = nodesById.get(element.toNodeId);
          if (!from || !to) return null;
          const a = projectPoint(from);
          const b = projectPoint(to);
          const labelX = a.x + 0.25 * (b.x - a.x);
          const labelY = a.y + 0.25 * (b.y - a.y);
          return (
            <g key={element.id}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />
              <text
                x={labelX}
                y={labelY - unitSize * 0.4}
                fontSize={unitSize}
                textAnchor="middle"
                className="fill-foreground stroke-none"
              >
                {element.name}
              </text>
            </g>
          );
        })}
      </g>

      {nodes.map((node) => {
        const { x, y } = projectPoint(node);
        return (
          <g key={node.id}>
            <circle cx={x} cy={y} r={nodeRadius} className="fill-primary" />
            <text
              x={x + nodeRadius * 1.6}
              y={y - nodeRadius * 1.6}
              fontSize={unitSize}
              className="fill-primary stroke-none"
            >
              {node.name}
            </text>
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
          unitSize={unitSize}
        />
      ))}

      {forces.map((force, i) => (
        <ForceArrow
          key={`${force.nodeId}-${force.axis}-${i}`}
          x={force.x}
          z={force.z}
          axis={force.axis}
          value={force.value}
          unitSize={unitSize}
          variant="force"
        />
      ))}
    </SvgCanvas>
  );
}

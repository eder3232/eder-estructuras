import { atom } from "jotai";

import { SingularStiffnessError, SpringElement, System, type SolveResult, type SolveWarning } from "@/lib/engine";
import type { DomainError, DomainIssue } from "@/components/custom/errors-panel";
import { displayNames, withDisplayNames } from "@/lib/display-names";
import { atomRestrainedFirst, atomUseDofNumbers } from "./dof-order";
import { atomElements, type ElementRow } from "./elements";
import { atomNodes, type NodeRow } from "./nodes";

/**
 * Los mismos tres estados que `/armaduras-2d` (ver su `store/results.ts`):
 * resuelto —con advertencias que conviven con los resultados—, error, y
 * **vacío**, que no es un error sino que todavía no hay nada que resolver.
 */
export type SpringsResults =
  | { status: "ok"; solved: SolveResult; warnings: DomainIssue[]; nodesById: Map<string, NodeRow> }
  | { status: "error"; errors: DomainError[]; nodesById: Map<string, NodeRow> }
  | { status: "empty"; reason: "no-nodes" | "no-elements"; nodeCount: number; nodesById: Map<string, NodeRow> };

/**
 * Las advertencias del motor están escritas para armaduras —hablan de
 * «barras», y de una «mucho más corta que el resto»—, y un resorte no tiene
 * largo. Acá se dicen en el idioma de este sistema; la que no tiene vocabulario
 * propio pasa tal cual.
 */
function inSpringTerms(warning: SolveWarning): string {
  switch (warning.code) {
    case "unconnected-node":
      return (
        "No tiene ningún resorte conectado, así que no aporta rigidez al modelo. " +
        "Su grado de libertad ocupa una fila y una columna en todas las matrices sin cambiar el resultado."
      );
    case "ill-conditioned":
      // La primera parte trae el número de condición, que se conserva.
      return `${warning.message.split(": suele pasar")[0]}: suele pasar cuando conviven resortes de rigideces muy distintas.`;
    default:
      return warning.message;
  }
}

/** Le pone nombre a lo que el motor solo sabe señalar por id. */
function toIssues(warnings: SolveWarning[], names: Map<string, string>, elements: ElementRow[]): DomainIssue[] {
  return warnings.map((warning) => ({
    ...warning,
    message: withDisplayNames(inSpringTerms(warning), names),
    severity: "warning" as const,
    refName:
      warning.source === "node"
        ? names.get(warning.refId)
        : warning.source === "element"
          ? elements.find((e) => e.id === warning.refId)?.name
          : undefined,
  }));
}

export const atomResults = atom<SpringsResults>((get) => {
  const nodes = get(atomNodes);
  const elements = get(atomElements);
  const restrainedFirst = get(atomRestrainedFirst);
  const useDofNumbers = get(atomUseDofNumbers);
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  // Antes de armar el sistema: un modelo sin resortes llega igual a `solve()`
  // y el motor lo reporta —con razón— como un mecanismo, que es una respuesta
  // rebuscada para "todavía no cargaste los resortes".
  if (nodes.length === 0 || elements.length === 0) {
    return { status: "empty", reason: nodes.length === 0 ? "no-nodes" : "no-elements", nodeCount: nodes.length, nodesById };
  }

  const system = new System(1);
  const errors: DomainError[] = [];
  // Los mensajes del motor nombran ids; acá se cambian por lo que ve el alumno.
  const names = displayNames(nodes, elements);
  const message = (e: unknown) => withDisplayNames(e instanceof Error ? e.message : String(e), names);

  for (const node of nodes) {
    try {
      system.addNode({
        id: node.id,
        restrained: [node.restrained],
        force: [node.force],
        displacement: [node.displacement],
        dofNumbers: [node.dofNumber],
      });
    } catch (e) {
      errors.push({ severity: "error", source: "node", refId: node.id, refName: node.name, message: message(e) });
    }
  }

  for (const element of elements) {
    try {
      // Antes que el motor: si el nudo se borró, su nombre ya no existe y el
      // mensaje del motor saldría con el id crudo. Lo mismo hace `/armaduras-2d`.
      if (!nodesById.has(element.fromNodeId) || !nodesById.has(element.toNodeId)) {
        throw new Error(`El elemento ${element.name} referencia un nudo inexistente.`);
      }
      system.addElement(new SpringElement(element.id, [element.fromNodeId, element.toNodeId], element.k));
    } catch (e) {
      errors.push({ severity: "error", source: "element", refId: element.id, refName: element.name, message: message(e) });
    }
  }

  if (errors.length > 0) {
    return { status: "error", errors, nodesById };
  }

  try {
    const solved = system.solve({ restrainedFirst, useDofNumbers });
    return { status: "ok", solved, warnings: toIssues(solved.warnings, names, elements), nodesById };
  } catch (e) {
    return {
      status: "error",
      errors: [
        {
          severity: "error",
          source: "element",
          refId: "-",
          message: message(e),
          // El diagnóstico viaja a la UI para poder decir qué nudo quedó suelto.
          mechanism: e instanceof SingularStiffnessError ? e.diagnosis : undefined,
        },
      ],
      nodesById,
    };
  }
});

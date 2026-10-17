"use client";

import { Button } from "@/components/ui/button";
import { CASES, type CaseId } from "../store/model";

/**
 * Elegir un caso de carga. Botones y no `ui/tabs`: nadie usó todavía ese
 * componente en el repo, y estrenar uno de `ui/` ya trajo sorpresas (ver
 * `docs/estado-actual.md`, «trampas que se repitieron»).
 */
export function CaseSelector({
  value,
  onChange,
  label,
}: {
  value: CaseId;
  onChange: (value: CaseId) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {CASES.map((c) => (
        <Button
          key={c.id}
          size="sm"
          variant={value === c.id ? "default" : "outline"}
          aria-pressed={value === c.id}
          onClick={() => onChange(c.id)}
        >
          {c.id} · {c.name}
        </Button>
      ))}
    </div>
  );
}

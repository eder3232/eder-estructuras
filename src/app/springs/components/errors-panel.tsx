"use client";

import { useAtom } from "jotai";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui-custom/alert";
import { atomResults } from "../store/results";

export function ErrorsPanel() {
  const [results] = useAtom(atomResults);

  if (results.status !== "error") return null;

  return (
    <div className="flex flex-col gap-2">
      {results.errors.map((error, i) => (
        <Alert key={i} variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {error.source === "node" ? "Error en un nudo" : "Error en un elemento"}
          </AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

import { AlertTriangle } from "lucide-react";

import type { MechanismDiagnosis } from "@/lib/engine";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui-custom/alert";

/**
 * Error de validación que tira el motor al armar el sistema, atribuido a la
 * fila que lo causó. Es el mismo contrato en todos los sistemas: el motor es
 * el único que decide qué es inválido, acá no se reimplementan códigos de error.
 */
export interface DomainError {
  source: "node" | "element";
  refId: string;
  message: string;
  /**
   * Presente solo cuando el sistema no se pudo resolver porque la estructura es
   * un mecanismo. Lo dibuja el panel de cada sistema —hace falta la geometría,
   * que acá no está—; este componente solo lo transporta.
   */
  mechanism?: MechanismDiagnosis;
}

/**
 * Presentación pura: cada sistema tiene su propio átomo de resultados, así que
 * el adaptador que lee ese átomo vive en `src/app/<sistema>/components/`, pero
 * el render es común a todos.
 */
export function ErrorsPanel({ errors }: { errors: DomainError[] }) {
  if (errors.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {errors.map((error, i) => (
        <Alert key={i} variant="destructive">
          <AlertTriangle />
          <AlertTitle>{error.source === "node" ? "Error en un nudo" : "Error en un elemento"}</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

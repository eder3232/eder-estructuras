"use client"

import * as React from "react"
import { evaluate } from "mathjs"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface FormulaInputProps {
  value: number
  onChange: (value: number) => void
  decimals?: number
  disabled?: boolean
  id?: string
  className?: string
  placeholder?: string
}

function formatDisplay(value: number, decimals: number) {
  if (!Number.isFinite(value)) return ""
  return Number.isInteger(value)
    ? String(value)
    : String(parseFloat(value.toFixed(decimals)))
}

/**
 * Input numerico estilo Excel: acepta un valor o una expresion (ej. "3.5*2"),
 * evaluada con mathjs al confirmar. Mientras se edita, el input queda
 * desacoplado del valor formateado para no pelear con lo que el usuario
 * escribe (ver docs/components.md).
 */
function FormulaInput({
  value,
  onChange,
  decimals = 4,
  disabled,
  id,
  className,
  placeholder,
}: FormulaInputProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  // Solo se lee mientras isEditing es true; se inicializa en onFocus, no
  // hace falta sincronizarlo con `value` fuera de edicion.
  const [draft, setDraft] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const isCancellingRef = React.useRef(false)

  function commit() {
    const raw = draft.trim()

    if (raw === "") {
      setDraft(formatDisplay(value, decimals))
      setIsEditing(false)
      return
    }

    try {
      const result = evaluate(raw)
      if (typeof result !== "number" || !Number.isFinite(result)) {
        throw new Error("La expresion no evaluo a un numero")
      }
      onChange(result)
      setDraft(formatDisplay(result, decimals))
    } catch {
      toast.error(`Expresion invalida: "${raw}"`, {
        description: "Se mantuvo el valor anterior.",
      })
      setDraft(formatDisplay(value, decimals))
    } finally {
      setIsEditing(false)
    }
  }

  return (
    <Input
      ref={inputRef}
      id={id}
      disabled={disabled}
      placeholder={placeholder}
      className={cn("text-right", className)}
      value={isEditing ? draft : formatDisplay(value, decimals)}
      onFocus={() => {
        setIsEditing(true)
        setDraft(formatDisplay(value, decimals))
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (isCancellingRef.current) {
          isCancellingRef.current = false
          return
        }
        commit()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          inputRef.current?.blur()
        }
        if (e.key === "Escape") {
          e.preventDefault()
          isCancellingRef.current = true
          setDraft(formatDisplay(value, decimals))
          setIsEditing(false)
          inputRef.current?.blur()
        }
      }}
    />
  )
}

export { FormulaInput }

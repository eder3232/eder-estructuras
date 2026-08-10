"use client"

import * as React from "react"
import { NumberField } from "@base-ui/react/number-field"
import { Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"

interface NumberInputProps
  extends Omit<
    React.ComponentProps<typeof NumberField.Root>,
    "children" | "render"
  > {
  className?: string
  inputClassName?: string
}

/**
 * Input numerico simple sobre NumberField de Base UI: stepper, flechas de
 * teclado y scrub. No evalua expresiones — para eso usar FormulaInput
 * (ver docs/components.md).
 */
function NumberInput({
  className,
  inputClassName,
  ...props
}: NumberInputProps) {
  return (
    <NumberField.Root className={cn("w-28", className)} {...props}>
      <NumberField.Group className="flex items-center gap-1 border-b border-input bg-transparent focus-within:border-b-ring">
        <NumberField.Decrement className="flex size-7 shrink-0 items-center justify-center text-muted-foreground outline-none hover:text-foreground disabled:pointer-events-none disabled:opacity-50">
          <Minus className="size-3.5" />
        </NumberField.Decrement>
        <NumberField.Input
          className={cn(
            "h-10 w-full min-w-0 border-0 bg-transparent px-0 py-1 text-center text-base outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            inputClassName
          )}
        />
        <NumberField.Increment className="flex size-7 shrink-0 items-center justify-center text-muted-foreground outline-none hover:text-foreground disabled:pointer-events-none disabled:opacity-50">
          <Plus className="size-3.5" />
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  )
}

export { NumberInput }

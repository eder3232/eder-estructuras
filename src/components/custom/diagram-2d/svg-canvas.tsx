import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { viewBoxAttr, type ViewBox } from "./viewbox";

interface SvgCanvasProps {
  viewBox: ViewBox;
  children: ReactNode;
  className?: string;
}

export function SvgCanvas({ viewBox, children, className }: SvgCanvasProps) {
  return (
    <div className={cn("h-80 w-80 rounded-md border bg-muted/20 md:h-[500px] md:w-[500px]", className)}>
      <svg viewBox={viewBoxAttr(viewBox)} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {children}
      </svg>
    </div>
  );
}

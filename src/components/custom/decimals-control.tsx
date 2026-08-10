"use client";

import { useAtom } from "jotai";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { atomDecimals } from "./decimals";

const OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function DecimalsControl() {
  const [decimals, setDecimals] = useAtom(atomDecimals);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span>Decimales:</span>
      <Select value={String(decimals)} onValueChange={(value) => setDecimals(Number(value))}>
        <SelectTrigger size="sm" className="w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

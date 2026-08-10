"use client";

import { useAtom } from "jotai";

import { ErrorsPanel as GenericErrorsPanel } from "@/components/custom/errors-panel";
import { atomResults } from "../store/results";

export function ErrorsPanel() {
  const [results] = useAtom(atomResults);

  return <GenericErrorsPanel errors={results.status === "error" ? results.errors : []} />;
}

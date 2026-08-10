import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-6 px-6">
      <h1 className="text-2xl font-bold">Thesis Refactor 2026</h1>
      <p className="text-muted-foreground">
        Refactor de una app de análisis estructural (método matricial de rigideces). En desarrollo activo.
      </p>
      <ul className="flex flex-col gap-2">
        <li>
          <Link href="/springs" className="font-medium underline underline-offset-4">
            Resortes
          </Link>
        </li>
      </ul>
    </div>
  );
}

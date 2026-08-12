import Link from "next/link";

import { siteConfig, systemLinks } from "@/lib/site-config";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-6 px-6">
      <h1 className="text-2xl font-bold">{siteConfig.name}</h1>
      <p className="text-muted-foreground">{siteConfig.description}</p>
      <ul className="flex flex-col gap-2">
        {systemLinks.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="font-medium underline underline-offset-4">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

import type { Metadata } from 'next'
import { Geist, Geist_Mono, JetBrains_Mono } from 'next/font/google'
import './globals.css'
// Estilos de las fórmulas (`src/components/custom/math.tsx`). Va en la raíz por
// la recomendación de Next para stylesheets externos, y una sola vez: KaTeX trae
// sus fuentes referenciadas con `url()` relativo desde este mismo archivo.
import 'katex/dist/katex.min.css'
import { cn } from '@/lib/utils'
import { siteConfig } from '@/lib/site-config'
import { SiteNavbar } from '@/components/custom/site-navbar'
import { ThemeProvider } from '@/components/custom/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'

const geistMonoHeading = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-heading',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  // `template` se aplica a los segmentos hijos, así que cuando una página de un
  // sistema exporte su propio `title` va a salir como "Armaduras 2D | Eder
  // Estructuras" sin repetir el nombre en cada archivo. `default` es obligatorio
  // cuando hay `template`.
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // `suppressHydrationWarning` es requisito de `next-themes`: su script inline
    // escribe la clase del tema en <html> antes de que React hidrate, así que el
    // DOM no coincide con lo que renderizó el servidor. Le dice a React que en
    // este elemento gana el DOM. Sin esto, React trata la diferencia como error
    // de hidratación y re-renderiza desde el cliente, que es exactamente el
    // parpadeo que el script inline existe para evitar.
    <html
      lang="es"
      suppressHydrationWarning
      className={cn(
        'h-full',
        'antialiased',
        geistSans.variable,
        geistMono.variable,
        'font-mono',
        jetbrainsMono.variable,
        geistMonoHeading.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <SiteNavbar />
            {children}
          </TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

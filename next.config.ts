import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La app no usa nada de servidor: se exporta como sitio estático (carpeta out/) y la sirve Cloudflare.
  output: "export",
  // Sin servidor no hay optimizador de imágenes; las del inicio ya son .webp livianos.
  images: { unoptimized: true },
};

export default nextConfig;

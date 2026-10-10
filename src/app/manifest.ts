import type { MetadataRoute } from "next";

/** Manifesto do app instalável (PWA): ícone na tela inicial, abre em tela cheia, sem barra do navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nail Agenda",
    short_name: "Nail Agenda",
    description: "Agenda privada do salão de unhas.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f5",
    theme_color: "#faf8f5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

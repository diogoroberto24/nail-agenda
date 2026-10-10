// Gera os ícones do app (PWA, favicon e ícone do iPhone) a partir do ícone "Sparkles" do login.
// Uso: npm run icons   (usa o Microsoft Edge já instalado; não baixa navegador)
// Marrom profundo de fundo e brilho off-white (paleta da marca). O ícone "maskable" deixa margem de segurança.

import { chromium } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Sparkles } from "lucide-react";
import { mkdirSync } from "node:fs";

const BG = "#51413E";
const FG = "#FAF8F5";

const TARGETS = [
  { file: "public/icons/icon-192.png", size: 192, scale: 0.6 },
  { file: "public/icons/icon-512.png", size: 512, scale: 0.6 },
  // maskable: o sistema recorta até 20% das bordas; o desenho fica dentro dos 60% centrais
  { file: "public/icons/icon-maskable-512.png", size: 512, scale: 0.46 },
  { file: "src/app/apple-icon.png", size: 180, scale: 0.6 },
  { file: "src/app/icon.png", size: 512, scale: 0.6 },
];

mkdirSync("public/icons", { recursive: true });

const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await browser.newPage();
  for (const { file, size, scale } of TARGETS) {
    const icon = renderToStaticMarkup(createElement(Sparkles, { size: Math.round(size * scale), color: FG, strokeWidth: 1.4 }));
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<body style="margin:0;width:${size}px;height:${size}px;background:${BG};display:flex;align-items:center;justify-content:center;position:relative">
         ${icon}
       </body>`,
    );
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: size, height: size } });
    console.log(`ok: ${file} (${size}x${size})`);
  }
} finally {
  await browser.close();
}

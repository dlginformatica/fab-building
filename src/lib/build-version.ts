// Build version iniettato da Vite (vedi vite.config.ts -> define.__BUILD_VERSION__)
// Formato: yyyy.mm.dd.hh.mm (UTC)
declare const __BUILD_VERSION__: string;

export const BUILD_VERSION: string =
  typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : "dev";

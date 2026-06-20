// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// Build version: yyyy.mm.dd.hh.mm (UTC) calcolato al momento del build
const _d = new Date();
const _pad = (n: number) => String(n).padStart(2, "0");
const BUILD_VERSION = `${_d.getUTCFullYear()}.${_pad(_d.getUTCMonth() + 1)}.${_pad(_d.getUTCDate())}.${_pad(_d.getUTCHours())}.${_pad(_d.getUTCMinutes())}`;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: {
          name: "HotelOps — Building & Facility Management",
          short_name: "HotelOps",
          description: "Gestione impianti, asset, ticket, SLA, fornitori e bollette.",
          theme_color: "#0f3a4a",
          background_color: "#0f172a",
          display: "standalone",
          start_url: "/app/tickets",
          scope: "/",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
          globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: { cacheName: "hotelops-pages", networkTimeoutSeconds: 4 },
            },
            {
              urlPattern: ({ url }) => url.origin === self.location.origin && /\.(?:js|css|woff2)$/.test(url.pathname),
              handler: "CacheFirst",
              options: { cacheName: "hotelops-assets", expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 } },
            },
            {
              urlPattern: ({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url.hostname),
              handler: "CacheFirst",
              options: { cacheName: "hotelops-fonts", expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
            },
          ],
        },
      }),
    ],
  },
});

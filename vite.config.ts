import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Allowed NS API prefixes. Caddy uses the same list in production (deploy/Caddyfile.dris).
const NS_PATHS = /^\/(reisinformatie-api|virtual-train-api|nsapp-stations|disruptions)\//

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Version of a package made with docker/pack.sh (the date it was made); 'dev' when working locally.
  const version = existsSync('VERSION') ? readFileSync('VERSION', 'utf8').trim() : 'dev'
  return {
    base: '/dris/',
    define: { __DRIS_VERSION__: JSON.stringify(version) },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          display: resolve(__dirname, 'index.html'),
          info: resolve(__dirname, 'info/index.html'),
        },
      },
    },
    server: {
      proxy: {
        // Same path as production: /dris/api/ns/<ns-path> → https://gateway.apiportal.ns.nl/<ns-path>
        '/dris/api/ns': {
          target: 'https://gateway.apiportal.ns.nl',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/dris\/api\/ns/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (req) => {
              if (!NS_PATHS.test(req.path)) {
                req.destroy(new Error('path not allowed'))
                return
              }
              req.setHeader('Ocp-Apim-Subscription-Key', env.NS_API_KEY ?? '')
              req.removeHeader('cookie')
            })
          },
        },
      },
    },
  }
})

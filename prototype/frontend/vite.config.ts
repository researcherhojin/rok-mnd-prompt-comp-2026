import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// /api/* → 백엔드(FastAPI, localhost:8000). rewrite로 /api 제거해 백엔드 경로(/problem…)에 매핑.
// 클라이언트 라우트(/leaderboard, /submit)와 충돌하지 않도록 프리픽스 분리.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base: './' — GitHub Pages(하위 경로)에서도 그대로 동작하도록 상대 경로로 빌드합니다.
export default defineConfig({
  base: './',
  plugins: [react()],
})

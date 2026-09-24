import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Word/PowerPoint/Excel кітапханалары үлкен, бірақ тек жүктеу батырмасы басылғанда ғана ашылады.
  build: { chunkSizeWarningLimit: 1000 },
})

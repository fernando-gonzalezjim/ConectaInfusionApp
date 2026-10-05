import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react(), tailwindcss()], server: { port: 5174, strictPort: true, fs: { deny: ['**/.[eE][nN][vV]', '**/.[eE][nN][vV].*', '**/*.[cC][rR][tT]', '**/*.[pP][eE][mM]', '**/.[gG][iI][tT]/**', '**/.[lL][oO][cC][aA][lL]/**', '**/[dD][eE][vV].[eE][nN][vV]'] }, proxy: { '/api': 'http://localhost:3001' } } });

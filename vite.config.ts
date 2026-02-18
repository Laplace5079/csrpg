/**
 * vite.config.ts - Vite 构建配置
 * 墨境：孤军 (Ink Realm: Lone Army)
 * WebGL 2.0 优化配置
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  // 基础路径
  base: '/',
  
  // 源代码目录
  root: '.',
  
  // 输出目录
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 1500,
    
    // Rollup 配置
    rollupOptions: {
      output: {
        // 代码分割
        manualChunks: {
          'three': ['three'],
          'physics': ['cannon-es'],
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
  
  // 开发服务器
  server: {
    port: 3000,
    open: true,
    host: '0.0.0.0',
  },
  
  // 预览服务器
  preview: {
    port: 4173,
    host: '0.0.0.0',
  },
  
  // 路径解析
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@engine': path.resolve(__dirname, './src/engine'),
      '@systems': path.resolve(__dirname, './src/systems'),
      '@data': path.resolve(__dirname, './src/data'),
      '@shaders': path.resolve(__dirname, './src/shaders'),
    },
  },
  
  // JSON 配置
  json: {
    stringify: true,
  },
  
  // 优化依赖
  optimizeDeps: {
    include: [
      'three',
      'cannon-es',
      'react',
      'react-dom',
      'zustand',
    ],
    exclude: [],
  },
  
  // 开发时排除依赖优化
  ssr: {
    noExternal: ['three', 'cannon-es'],
  },
});

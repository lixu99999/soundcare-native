import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [
    uni(),
    {
      // HBuilderX 标准基座用 file:// 加载 dist/build 产物。
      // Vite 默认输出 <script type="module" crossorigin>，WKWebView 触发 CORS 预检，
      // file:// origin 是 null，被 Safari 拒绝 → 白屏。
      // 移除 type="module" 和 crossorigin 后按 classic 资源加载，不做 CORS 预检。
      name: 'fix-app-inside-cors',
      transformIndexHtml: {
        order: 'post',
        handler(html) {
          if (!html.includes('crossorigin')) return html
          return html
            .replace(/<script\s+type="module"\s+crossorigin\s+/g, '<script ')
            .replace(/<link\s+rel="stylesheet"\s+crossorigin\s+/g, '<link rel="stylesheet" ')
        }
      }
    }
  ],
  server: {
    port: 3001
  }
})

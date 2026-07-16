import { responsivePx } from './build/postcss-responsive-px'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  buildDir: process.env.NUXT_BUILD_DIR || '.nuxt',
  modules: ['@element-plus/nuxt'],
  compatibilityDate: '2025-07-15',
  runtimeConfig: {
    public: {
      appOrigin: '',
      assetBaseUrl: ''
    }
  },
  css: ['~/assets/css/reset.less'],
  devtools: { enabled: false },
  app: {
    head: {
      link: [
        { rel: 'preload', href: '/chessPrice/font/font1.ttf', as: 'font', type: 'font/ttf', crossorigin: 'anonymous' },
        { rel: 'preload', href: '/chessPrice/font/kaiti.ttf?v=33a4f512', as: 'font', type: 'font/ttf', crossorigin: 'anonymous' }
      ]
    }
  },
  vite: {
    css: {
      postcss: {
        plugins: [responsivePx()]
      },
      preprocessorOptions: {
        less: {
          additionalData: '@import "~/assets/css/mixins.less";'
        }
      }
    }
  },
  nitro: {
    experimental: {
      websocket: true
    }
  },
})

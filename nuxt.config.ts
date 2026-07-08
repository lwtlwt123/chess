// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@element-plus/nuxt'],
  compatibilityDate: '2025-07-15',
  css: ['~/assets/css/reset.css'],
  devtools: { enabled: false },
  vite: {
    css: {
      preprocessorOptions: {
        less: {
          additionalData: '@import "~/assets/css/mixins.less";'
        }
      }
    }
  }
})

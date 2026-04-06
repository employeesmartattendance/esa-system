import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'

const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID

if (gaMeasurementId) {
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args) {
    window.dataLayer.push(args)
  }
  window.gtag('js', new Date())
  window.gtag('config', gaMeasurementId, { send_page_view: false })

  router.afterEach((to) => {
    window.gtag('event', 'page_view', {
      page_path: to.fullPath,
      page_title: document.title,
      page_location: window.location.href,
    })
  })
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

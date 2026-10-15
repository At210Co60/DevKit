import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from '@/App.vue'
import { router } from '@/app/router'
import '@/styles/main.css'

/**
 * 应用入口 —— 只做装配，不含任何业务逻辑
 */
const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

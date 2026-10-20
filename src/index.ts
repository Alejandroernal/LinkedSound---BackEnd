import { createApp } from './app.js'
import { config } from './config/environment.js'

const app = createApp()

app.listen(config.port, () => {
  console.log(`LinkedSound backend server running on port ${config.port} in ${config.nodeEnv} mode`)
})

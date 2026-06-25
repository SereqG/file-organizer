import { createApp } from './app'
import { loadConfig } from './config'

async function main() {
  const config = loadConfig()
  const app = createApp(config)
  await app.listen({ port: config.port })
  console.log(`Server running on port ${config.port}`)
}

main().catch(console.error)

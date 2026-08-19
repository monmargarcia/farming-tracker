import 'dotenv/config'
import { buildApp } from './app.js'

const app = await buildApp()

const port = parseInt(process.env.PORT ?? '3001')
await app.listen({ port, host: '0.0.0.0' })
console.log(`Farming tracker API running on port ${port}`)

import app from './screenshot.js'

Bun.serve({
  fetch: app.fetch,
  port: 3000,
  idleTimeout: 60 //detik
})

console.log("🚀 Screenshot API aktif di http://localhost:3000")

require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const { initWebSocket } = require("./src/websocket/ws_emitter");

const PORT = process.env.PORT || 3000;

// Create HTTP server from Express app
const server = http.createServer(app);

// Attach WebSocket server
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

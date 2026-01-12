let wss = null;
let heartbeatInterval = null;

function initWebSocket(server) {
  const WebSocket = require("ws");
  wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    console.log("🟢 WebSocket client connected");

    // mark alive and respond to pongs
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on("close", () => {
      console.log("🔴 WebSocket client disconnected");
    });

    ws.on('error', (err) => {
      // prevent uncaught exceptions from killing the server
      console.warn('⚠️ WebSocket client error', err && err.message);
    });
  });

  // Heartbeat: ping clients every 30s and terminate non-responsive ones
  if (!heartbeatInterval) {
    heartbeatInterval = setInterval(() => {
      if (!wss) return;
      wss.clients.forEach((client) => {
        try {
          if (client.isAlive === false) {
            console.log('⛔ Terminating dead WS client');
            return client.terminate();
          }

          client.isAlive = false;
          // send a ping; 'ws' library will emit 'pong' on reply
          client.ping(() => {});
        } catch (e) {
          // ignore individual client errors
        }
      });
    }, 30000);

    // Clear heartbeat when server closes
    wss.on('close', () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    });
  }
}

function emitScanEvent(payload) {
  if (!wss) return;

  const message = JSON.stringify({
    type: "SCAN_EVENT",
    payload
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      try {
        client.send(message);
      } catch (e) {
        // ignore send errors per-client
      }
    }
  });

  // small debug
  // console.log('📤 Emitted SCAN_EVENT to clients');
}

/**
 * Emit dashboard update event for real-time analytics updates
 */
function emitDashboardUpdate(eventType, payload) {
  if (!wss) return;

  const message = JSON.stringify({
    type: "DASHBOARD_UPDATE",
    eventType, // ENTRY, EXIT, EQUIPMENT_ISSUE, EQUIPMENT_RETURN
    payload,
    timestamp: new Date().toISOString()
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      try {
        client.send(message);
      } catch (e) {
        // ignore per-client send error
      }
    }
  });
}

/**
 * Emit occupancy update event
 */
function emitOccupancyUpdate(facility, delta, current) {
  emitDashboardUpdate("OCCUPANCY_CHANGE", {
    facility,
    delta,
    current
  });
}

module.exports = {
  initWebSocket,
  emitScanEvent,
  emitDashboardUpdate,
  emitOccupancyUpdate
};

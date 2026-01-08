let wss = null;

function initWebSocket(server) {
  const WebSocket = require("ws");
  wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    console.log("🟢 WebSocket client connected");

    ws.on("close", () => {
      console.log("🔴 WebSocket client disconnected");
    });
  });
}

function emitScanEvent(payload) {
  if (!wss) return;

  const message = JSON.stringify({
    type: "SCAN_EVENT",
    payload
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
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
      client.send(message);
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

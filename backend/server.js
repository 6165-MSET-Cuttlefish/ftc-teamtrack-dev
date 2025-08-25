const express = require("express");
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Option 1: Use service account key file (uncomment and update path)
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Option 2: Use environment variables (recommended for production)
// admin.initializeApp({
//   credential: admin.credential.applicationDefault()
// });

const db = admin.firestore();
const app = express();
app.use(express.json());

// Helper: normalize keys and handle nested objects
function toSession(body) {
  const get = (a, b) => (body[a] ?? body[b]);
  // Handle nested structure (info, auto, teleop) OR flat structure
  const info = body.info || {};
  const auto = body.auto || {};
  const teleop = body.teleop || {};
  
  return {
    sessionName: info.sessionName || get("sessionName", "session name"),
    driverName: info.driverName || get("driverName", "driver name"),
    matchType: info.matchType || get("matchType", "match type"),
    
    // Map auto fields
    autonBasket: Number(auto.lowBasket || body.autonBasket || 0),
    autonSpeci: Number(auto.highBasket || body.autonSpeci || 0), 
    autonFloor: Number(auto.netZone || body.autonFloor || 0),
    autonRung: Number(auto.lowRung || body.autonRung || 0),
    autonHighRung: Number(auto.highRung || body.autonHighRung || 0),
    
    // Map teleop fields  
    teleBasket: Number(teleop.lowBasket || body.teleBasket || 0),
    teleSpeci: Number(teleop.highBasket || body.teleSpeci || 0),
    teleNetZone: Number(teleop.netZone || body.teleNetZone || 0),
    teleLowRung: Number(teleop.lowRung || body.teleLowRung || 0),
    teleHighRung: Number(teleop.highRung || body.teleHighRung || 0),
    
    // Endgame
    endgameHang: Number(teleop.ascentLevel || body.endgameHang || 0),
    endgamePark: Number(body.endgamePark || 0),
    
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

// --- Router: /sessions ---
const router = express.Router();

// Create a session
router.post("/", async (req, res) => {
  try {
    const s = toSession(req.body);
    
    // minimal validation - check for nested or flat structure
    const sessionName = req.body.info?.sessionName || req.body.sessionName;
    const driverName = req.body.info?.driverName || req.body.driverName;
    
    if (!sessionName || !driverName) {
      return res
        .status(400)
        .json({ error: "sessionName and driverName are required (either flat or in info object)." });
    }
    
    // Add document to Firestore
    const docRef = await db.collection('sessions').add(s);
    
    // Get the created document to return it with the ID
    const doc = await docRef.get();
    const responseData = { id: doc.id, ...doc.data() };
    
    // Convert Firestore timestamp to ISO string for consistency
    if (responseData.createdAt && responseData.createdAt.toDate) {
      responseData.createdAt = responseData.createdAt.toDate().toISOString();
    }
    
    res.status(201).json(responseData);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// List all sessions (JSON)
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection('sessions').orderBy('createdAt', 'desc').get();
    const sessions = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      // Convert Firestore timestamp to ISO string
      if (data.createdAt && data.createdAt.toDate) {
        data.createdAt = data.createdAt.toDate().toISOString();
      }
      sessions.push({ id: doc.id, ...data });
    });
    
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Optional: get one by id
router.get("/:id", async (req, res) => {
  try {
    const doc = await db.collection('sessions').doc(req.params.id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const data = doc.data();
    // Convert Firestore timestamp to ISO string
    if (data.createdAt && data.createdAt.toDate) {
      data.createdAt = data.createdAt.toDate().toISOString();
    }
    
    res.json({ id: doc.id, ...data });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Simple HTML view using res.send
router.get("/view/all", async (req, res) => {
  try {
    const snapshot = await db.collection('sessions').orderBy('createdAt', 'desc').get();
    const sessions = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      // Convert Firestore timestamp to Date object for display
      if (data.createdAt && data.createdAt.toDate) {
        data.createdAt = data.createdAt.toDate();
      }
      sessions.push({ id: doc.id, ...data });
    });

    const rows = sessions.map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${s.createdAt ? s.createdAt.toLocaleString() : 'N/A'}</td>
        <td>${s.sessionName}</td>
        <td>${s.driverName}</td>
        <td>${s.matchType}</td>
        <!-- AUTON -->
        <td>${s.autonBasket}</td>
        <td>${s.autonSpeci}</td>
        <td>${s.autonFloor}</td>
        <!-- TELEOP -->
        <td>${s.teleBasket}</td>
        <td>${s.teleSpeci}</td>
        <!-- ENDGAME -->
        <td>${s.endgameHang}</td>
        <td>${s.endgamePark}</td>
      </tr>`).join('');
      
    res.send(`<!doctype html>
    <html><head><meta charset="utf-8"><title>Sessions</title>
    <style>
      body{font-family:system-ui,Arial,sans-serif;padding:20px}
      table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
      th{background:#f5f5f5}
    </style></head><body>
    <h1>All Sessions</h1>
    <table>
      <thead>
        <tr>
          <th>ID</th><th>Created</th><th>Session</th><th>Driver</th><th>Match</th>
          <th>autonBasket</th><th>autonSpeci</th><th>autonFloor</th>
          <th>teleBasket</th><th>teleSpeci</th>
          <th>endgameHang</th><th>endgamePark</th>
        </tr>
      </thead>
      <tbody>${rows || "<tr><td colspan='13'>No sessions yet</td></tr>"}</tbody>
    </table>
    </body></html>`);
  } catch (error) {
    console.error('Error fetching sessions for view:', error);
    res.send('<h1>Error loading sessions</h1><p>Please try again later.</p>');
  }
});

app.use("/sessions", router);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});

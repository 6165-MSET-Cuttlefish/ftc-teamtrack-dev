// Load environment variables
require('dotenv').config();

const express = require('express');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseApp;

try {
  // Option 1: Try to use service account key file (for production/when available)
  const serviceAccount = require('./serviceAccountKey.json');
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('Firebase initialized with service account key');
} catch (error) {
  console.log('Service account key not found, trying environment variables...');

  // Option 2: Use environment variables (recommended for development)
  try {
    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_CLIENT_EMAIL
    ) {
      // Full service account credentials
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log('Firebase initialized with environment variables');
    } else if (process.env.FIREBASE_PROJECT_ID) {
      // Development mode with just project ID - use application default credentials
      console.log('Using Firebase project ID with application default credentials...');
      firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
      console.log(`Firebase initialized for project: ${process.env.FIREBASE_PROJECT_ID}`);
    } else {
      console.log(
        'Firebase project ID not found. Skipping Firebase initialization for development.'
      );
      
      // Skip Firebase initialization in development mode
      throw new Error('No Firebase configuration provided for development mode');
    }
  } catch (envError) {
    console.error('Failed to initialize Firebase Admin SDK:', envError.message);
    console.log(
      'Starting server without Firebase (sessions will not be saved)'
    );

    // Initialize a mock admin for development
    firebaseApp = null;
  }
}

const db = firebaseApp ? admin.firestore() : null;
const app = express();

// Add CORS middleware for frontend communication
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// Helper: normalize keys and handle nested objects
function toSession(body) {
  const get = (a, b) => body[a] ?? body[b];
  // Handle nested structure (info, auto, teleop) OR flat structure
  const info = body.info || {};
  const auto = body.auto || {};
  const teleop = body.teleop || {};

  // Helper function to ensure no undefined values
  const safeString = (value, defaultValue = '') => {
    return value !== undefined && value !== null && value !== ''
      ? String(value)
      : defaultValue;
  };

  const safeNumber = (value, defaultValue = 0) => {
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  };

  return {
    sessionName: safeString(
      info.sessionName || get('sessionName', 'session name'),
      'Untitled Session'
    ),
    driverName: safeString(
      info.driverName || get('driverName', 'driver name'),
      'Unknown Driver'
    ),
    matchType: safeString(
      info.matchType || get('matchType', 'match type'),
      'Practice'
    ),
    sessionDuration: safeString(body.sessionDuration, '0:00'),

    // User information for authentication
    userId: safeString(body.userId, ''),
    userEmail: safeString(body.userEmail, ''),

    // Map auto fields
    autonBasket: safeNumber(auto.lowBasket || body.autonBasket),
    autonSpeci: safeNumber(auto.highBasket || body.autonSpeci),
    autonFloor: safeNumber(auto.netZone || body.autonFloor),
    autonRung: safeNumber(auto.lowRung || body.autonRung),
    autonHighRung: safeNumber(auto.highRung || body.autonHighRung),

    // Map teleop fields
    teleBasket: safeNumber(teleop.lowBasket || body.teleBasket),
    teleSpeci: safeNumber(teleop.highBasket || body.teleSpeci),
    teleNetZone: safeNumber(teleop.netZone || body.teleNetZone),
    teleLowRung: safeNumber(teleop.lowRung || body.teleLowRung),
    teleHighRung: safeNumber(teleop.highRung || body.teleHighRung),

    // Endgame
    endgameHang: safeNumber(teleop.ascentLevel || body.endgameHang),
    endgamePark: safeNumber(body.endgamePark),

    // Additional fields
    finalScore: safeNumber(body.finalScore),
    completedAt: safeString(body.completedAt),

    createdAt: firebaseApp
      ? admin.firestore.FieldValue.serverTimestamp()
      : new Date().toISOString(),
  };
}

// --- Router: /sessions ---
const router = express.Router();

// Create a session
router.post('/', async (req, res) => {
  try {
    // Check if Firebase is available
    if (!db) {
      return res.status(503).json({
        error: 'Database not available. Please configure Firebase credentials.',
        details: 'Firebase Admin SDK is not properly initialized.',
      });
    }

    const s = toSession(req.body);

    // Enhanced validation - check for required fields
    const sessionName = req.body.info?.sessionName || req.body.sessionName;
    const driverName = req.body.info?.driverName || req.body.driverName;

    // Log the incoming data for debugging
    console.log('Incoming session data:', JSON.stringify(req.body, null, 2));
    console.log('Processed session data:', JSON.stringify(s, null, 2));

    if (!sessionName || sessionName.trim() === '') {
      return res
        .status(400)
        .json({ error: 'sessionName is required and cannot be empty.' });
    }

    if (!driverName || driverName.trim() === '') {
      return res
        .status(400)
        .json({ error: 'driverName is required and cannot be empty.' });
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
    res
      .status(500)
      .json({ error: 'Failed to create session', details: error.message });
  }
});

// List all sessions with enhanced filtering and pagination (JSON)
router.get('/', async (req, res) => {
  try {
    // Check if Firebase is available
    if (!db) {
      return res.status(503).json({
        error: 'Database not available. Please configure Firebase credentials.',
        details: 'Firebase Admin SDK is not properly initialized.',
        sessions: [],
      });
    }

    const {
      userId,
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      matchType,
      dateFrom,
      dateTo,
    } = req.query;

    let query = db.collection('sessions');

    // Filter by userId if provided
    if (userId) {
      query = query.where('userId', '==', userId);
    }

    // Filter by match type if provided
    if (matchType && matchType !== 'all') {
      query = query.where('matchType', '==', matchType);
    }

    // Date range filtering
    if (dateFrom) {
      query = query.where('createdAt', '>=', new Date(dateFrom));
    }
    if (dateTo) {
      query = query.where('createdAt', '<=', new Date(dateTo));
    }

    // Apply sorting
    const sortDirection = sortOrder === 'asc' ? 'asc' : 'desc';
    query = query.orderBy(sortBy, sortDirection);

    // Apply pagination
    if (offset > 0) {
      query = query.offset(parseInt(offset));
    }
    if (limit > 0) {
      query = query.limit(parseInt(limit));
    }

    const snapshot = await query.get();
    const sessions = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      // Convert Firestore timestamp to ISO string
      if (data.createdAt && data.createdAt.toDate) {
        data.createdAt = data.createdAt.toDate().toISOString();
      }
      sessions.push({ id: doc.id, ...data });
    });

    // Get total count for pagination info
    let totalCount = 0;
    if (userId) {
      const countQuery = db
        .collection('sessions')
        .where('userId', '==', userId);
      const countSnapshot = await countQuery.count().get();
      totalCount = countSnapshot.data().count;
    }

    res.json({
      sessions,
      pagination: {
        total: totalCount,
        offset: parseInt(offset),
        limit: parseInt(limit),
        hasMore: sessions.length === parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res
      .status(500)
      .json({ error: 'Failed to fetch sessions', details: error.message });
  }
});

// Get user session statistics
router.get('/stats/:userId', async (req, res) => {
  try {
    // Check if Firebase is available
    if (!db) {
      return res.status(503).json({
        error: 'Database not available. Please configure Firebase credentials.',
        details: 'Firebase Admin SDK is not properly initialized.',
      });
    }

    const { userId } = req.params;
    const snapshot = await db
      .collection('sessions')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    if (snapshot.empty) {
      return res.json({
        totalSessions: 0,
        averageScore: 0,
        highestScore: 0,
        totalPlayTime: 0,
        matchTypeBreakdown: {},
        recentSessions: [],
        performanceTrend: [],
      });
    }

    const sessions = [];
    let totalScore = 0;
    let highestScore = 0;
    let totalPlayTime = 0;
    const matchTypeBreakdown = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.createdAt && data.createdAt.toDate) {
        data.createdAt = data.createdAt.toDate().toISOString();
      }

      const session = { id: doc.id, ...data };
      sessions.push(session);

      // Calculate statistics
      const score = session.finalScore || 0;
      totalScore += score;
      highestScore = Math.max(highestScore, score);

      // Parse session duration (format: "MM:SS")
      if (session.sessionDuration) {
        const [minutes, seconds] = session.sessionDuration
          .split(':')
          .map(Number);
        totalPlayTime += minutes * 60 + (seconds || 0);
      }

      // Match type breakdown
      const matchType = session.matchType || 'Unknown';
      matchTypeBreakdown[matchType] = (matchTypeBreakdown[matchType] || 0) + 1;
    });

    const totalSessions = sessions.length;
    const averageScore =
      totalSessions > 0 ? Math.round(totalScore / totalSessions) : 0;

    // Performance trend (last 10 sessions)
    const performanceTrend = sessions
      .slice(0, 10)
      .reverse()
      .map(session => ({
        date: session.createdAt,
        score: session.finalScore || 0,
      }));

    res.json({
      totalSessions,
      averageScore,
      highestScore,
      totalPlayTime: Math.round(totalPlayTime / 60), // Convert to minutes
      matchTypeBreakdown,
      recentSessions: sessions.slice(0, 5),
      performanceTrend,
    });
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res
      .status(500)
      .json({ error: 'Failed to fetch session stats', details: error.message });
  }
});

// Optional: get one by id
router.get('/:id', async (req, res) => {
  try {
    // Check if Firebase is available
    if (!db) {
      return res.status(503).json({
        error: 'Database not available. Please configure Firebase credentials.',
        details: 'Firebase Admin SDK is not properly initialized.',
      });
    }

    const doc = await db.collection('sessions').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Session not found' });
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
router.get('/view/all', async (req, res) => {
  try {
    // Check if Firebase is available
    if (!db) {
      return res.send(`
        <!doctype html>
        <html><head><meta charset="utf-8"><title>Sessions</title>
        <style>
          body{font-family:system-ui,Arial,sans-serif;padding:20px}
          .error{background:#f8d7da;color:#721c24;padding:15px;border-radius:5px;margin:20px 0}
        </style></head><body>
        <h1>Sessions Dashboard</h1>
        <div class="error">
          <strong>Database not available:</strong> Please configure Firebase credentials to view sessions.
        </div>
        </body></html>
      `);
    }

    const snapshot = await db
      .collection('sessions')
      .orderBy('createdAt', 'desc')
      .get();
    const sessions = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      // Convert Firestore timestamp to Date object for display
      if (data.createdAt && data.createdAt.toDate) {
        data.createdAt = data.createdAt.toDate();
      }
      sessions.push({ id: doc.id, ...data });
    });

    const rows = sessions
      .map(
        s => `
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
      </tr>`
      )
      .join('');

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

app.use('/sessions', router);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});

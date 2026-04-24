const { AccessToken } = require('livekit-server-sdk');
const { Pool } = require('pg');

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS join_counts (
      rc_user_id    TEXT        NOT NULL,
      month_key     TEXT        NOT NULL,
      join_count    INT         NOT NULL DEFAULT 0,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (rc_user_id, month_key)
    );
    CREATE TABLE IF NOT EXISTS join_events (
      rc_user_id  TEXT        NOT NULL,
      room_id     TEXT        NOT NULL,
      month_key   TEXT        NOT NULL,
      joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (rc_user_id, room_id, month_key)
    );
    CREATE TABLE IF NOT EXISTS create_counts (
      rc_user_id    TEXT        NOT NULL,
      create_count  INT         NOT NULL DEFAULT 0,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (rc_user_id)
    );
    CREATE TABLE IF NOT EXISTS create_requests (
      request_id    TEXT        NOT NULL,
      rc_user_id    TEXT        NOT NULL,
      response_json JSONB       NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (request_id)
    );
    CREATE INDEX IF NOT EXISTS idx_create_requests_created_at
      ON create_requests(created_at);
  `);
}

initDb().catch(err => console.error('DB init error:', err));

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}
const http = require('http');
const url = require('url');

const API_KEY = 'API8pH7DjdozgXn';
const API_SECRET = 'hfOoTA56befhe6yrAduoDJRVBt4fFIuJuKcMf6C3GwKN';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const activeUsers = {};
const pushTokens = {};
const lockedRooms = new Set();

setInterval(() => {
  const now = Date.now();
  Object.keys(activeUsers).forEach(userId => {
    if (now - activeUsers[userId].lastSeen > 35000) {
      const room = activeUsers[userId].room;
      delete activeUsers[userId];
      
      // Auto-unlock room if no one is left
      const anyoneLeft = Object.values(activeUsers).some(u => u.room === room);
      if (!anyoneLeft) {
        lockedRooms.delete(room);
      }
    }
  });
}, 15000);

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const params = parsedUrl.query;

  // Get token and check in
  if (path === '/' || path === '') {
    const roomName = params.room || 'default-room';
    const userId = params.userId || 'usr_' + Math.random().toString(36).substring(2, 10);
    const displayName = params.name || userId;

    // Check if room is locked
    if (lockedRooms.has(roomName) && !params.invited) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Room is locked', locked: true }));
      return;
    }

    activeUsers[userId] = { room: roomName, displayName, lastSeen: Date.now() };

    const token = new AccessToken(API_KEY, API_SECRET, {
      identity: userId,
      name: displayName,
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ token: jwt, userId, displayName }));
    return;
  }

  // Lock/unlock room
  if (path === '/lock') {
    const roomName = params.room;
    const action = params.action; // 'lock' or 'unlock'
    if (roomName) {
      if (action === 'lock') {
        lockedRooms.add(roomName);
      } else {
        lockedRooms.delete(roomName);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, locked: lockedRooms.has(roomName) }));
    return;
  }

  // Check if room is locked
  if (path === '/room-status') {
    const roomName = params.room;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ locked: lockedRooms.has(roomName) }));
    return;
  }

  // Register push token
  if (path === '/register-push') {
    const userId = params.userId;
    const pushToken = params.token;
    console.log('Register push called - userId:', userId, 'token:', pushToken);
    if (userId && pushToken) {
      pushTokens[userId] = pushToken;
      console.log('Push token saved for:', userId);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // Send invite
  if (path === '/invite') {
    const fromUserId = params.fromUserId;
    const toUserId = params.toUserId;
    const roomCode = params.room;
    const fromName = params.fromName;

    const pushToken = pushTokens[toUserId];

    if (!pushToken) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User push token not found' }));
      return;
    }

    try {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: pushToken,
          title: '🎵 SoundZone Invite',
          body: `${fromName} invited you to join group ${roomCode}`,
          data: { roomCode, type: 'invite' },
          sound: 'default',
        }),
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to send push notification' }));
    }
    return;
  }

  // Heartbeat
  if (path === '/heartbeat') {
    const userId = params.userId;
    const roomName = params.room;
    if (userId && activeUsers[userId]) {
      activeUsers[userId].lastSeen = Date.now();
      activeUsers[userId].room = roomName;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // Leave room
  if (path === '/leave') {
    const userId = params.userId;
    if (userId && activeUsers[userId]) {
      const room = activeUsers[userId].room;
      delete activeUsers[userId];
      
      // Auto-unlock room if no one is left in it
      const anyoneLeft = Object.values(activeUsers).some(u => u.room === room);
      if (!anyoneLeft) {
        lockedRooms.delete(room);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }
  
  // Record a join attempt (atomic, unique room tracking)
  if (path === '/record-join') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { rc_user_id, room_id } = JSON.parse(body);
        if (!rc_user_id || !room_id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'rc_user_id and room_id required' }));
          return;
        }

        const monthKey = getCurrentMonthKey();

        // Try to insert this unique join event
        // If it already exists (same user + room + month), do nothing
        const eventResult = await db.query(`
          INSERT INTO join_events (rc_user_id, room_id, month_key)
          VALUES ($1, $2, $3)
          ON CONFLICT (rc_user_id, room_id, month_key) DO NOTHING
          RETURNING rc_user_id
        `, [rc_user_id, room_id, monthKey]);

        const isNewRoom = eventResult.rowCount > 0;

        if (isNewRoom) {
          // Atomically increment the counter
          const countResult = await db.query(`
            INSERT INTO join_counts (rc_user_id, month_key, join_count)
            VALUES ($1, $2, 1)
            ON CONFLICT (rc_user_id, month_key) DO UPDATE
              SET join_count = join_counts.join_count + 1,
                  updated_at = NOW()
            RETURNING join_count
          `, [rc_user_id, monthKey]);

          const joinCount = countResult.rows[0].join_count;
          const remaining = Math.max(0, 15 - joinCount);
          const allowed = joinCount <= 15;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ allowed, join_count: joinCount, remaining, new_room: true }));
        } else {
          // Already joined this room this month — don't increment
          const countResult = await db.query(`
            SELECT join_count FROM join_counts
            WHERE rc_user_id = $1 AND month_key = $2
          `, [rc_user_id, monthKey]);

          const joinCount = countResult.rows[0]?.join_count ?? 0;
          const remaining = Math.max(0, 15 - joinCount);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ allowed: true, join_count: joinCount, remaining, new_room: false }));
        }
      } catch (err) {
        console.error('/record-join error:', err);
        // Fail open — never block a user due to backend error
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ allowed: true, join_count: 0, remaining: 15, error: 'db_error' }));
      }
    });
    return;
  }

  // Get current join status for a user
  if (path === '/join-status') {
    const rcUserId = params.rc_user_id;
    if (!rcUserId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'rc_user_id required' }));
      return;
    }

    try {
      const monthKey = getCurrentMonthKey();
      const result = await db.query(`
        SELECT join_count FROM join_counts
        WHERE rc_user_id = $1 AND month_key = $2
      `, [rcUserId, monthKey]);

      const joinCount = result.rows[0]?.join_count ?? 0;
      const remaining = Math.max(0, 15 - joinCount);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        join_count: joinCount,
        remaining,
        limit: 15,
        limit_reached: joinCount >= 15,
      }));
    } catch (err) {
      console.error('/join-status error:', err);
      // Fail open
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ join_count: 0, remaining: 15, limit: 15, limit_reached: false, error: 'db_error' }));
    }
    return;
  }

  // Get create status for a user
  if (path === '/create-status') {
    const rcUserId = params.rc_user_id;
    if (!rcUserId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'rc_user_id required' }));
      return;
    }
    try {
      const result = await db.query(`
        SELECT create_count FROM create_counts
        WHERE rc_user_id = $1
      `, [rcUserId]);
      const createCount = result.rows[0]?.create_count ?? 0;
      const remaining = Math.max(0, 2 - createCount);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        create_count: createCount,
        remaining,
        limit: 2,
        limit_reached: createCount >= 2,
      }));
    } catch (err) {
      console.error('/create-status error:', err);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ create_count: 0, remaining: 2, limit: 2, limit_reached: false, error: 'db_error' }));
    }
    return;
  }

  // Record a create attempt (check-then-increment, atomic, idempotent)
  if (path === '/record-create') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { rc_user_id, request_id } = JSON.parse(body);
        if (!rc_user_id || !request_id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'rc_user_id and request_id required' }));
          return;
        }

        // Check for duplicate request — return cached response if exists
        const dupCheck = await db.query(`
          SELECT response_json FROM create_requests
          WHERE request_id = $1
        `, [request_id]);
        if (dupCheck.rows.length > 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(dupCheck.rows[0].response_json));
          return;
        }

        // Get current count
        const countResult = await db.query(`
          SELECT create_count FROM create_counts
          WHERE rc_user_id = $1
        `, [rc_user_id]);
        const currentCount = countResult.rows[0]?.create_count ?? 0;

        let response;
        if (currentCount >= 2) {
          // Limit reached — do not increment
          response = {
            allowed: false,
            create_count: currentCount,
            remaining: 0,
          };
        } else {
          // Atomic increment
          const updated = await db.query(`
            INSERT INTO create_counts (rc_user_id, create_count)
            VALUES ($1, 1)
            ON CONFLICT (rc_user_id) DO UPDATE
              SET create_count = create_counts.create_count + 1,
                  updated_at = NOW()
            RETURNING create_count
          `, [rc_user_id]);
          const newCount = updated.rows[0].create_count;
          response = {
            allowed: true,
            create_count: newCount,
            remaining: Math.max(0, 2 - newCount),
          };
        }

        // Store request for idempotency — prune requests older than 24 hours
        await db.query(`
          INSERT INTO create_requests (request_id, rc_user_id, response_json)
          VALUES ($1, $2, $3)
          ON CONFLICT (request_id) DO NOTHING
        `, [request_id, rc_user_id, JSON.stringify(response)]);
        await db.query(`
          DELETE FROM create_requests
          WHERE created_at < NOW() - INTERVAL '24 hours'
        `);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));

      } catch (err) {
        console.error('/record-create error:', err);
        // Fail open
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ allowed: true, create_count: 0, remaining: 2, error: 'db_error' }));
      }
    });
    return;
  }

  /// Debug - check push tokens (remove before launch)
  if (path === '/debug-tokens') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tokens: Object.keys(pushTokens), count: Object.keys(pushTokens).length }));
    return;
  }
  // Log client errors for debugging
  if (path === '/log-error') {
    console.log('Client error - userId:', params.userId, 'error:', params.error);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }
  // Get status by userIds
  if (path === '/status') {
    const ids = params.ids ? params.ids.split(',') : [];
    const result = {};
    ids.forEach(id => {
      if (activeUsers[id]) {
        const room = activeUsers[id].room;
        result[id] = {
          online: true,
          room,
          displayName: activeUsers[id].displayName,
          locked: lockedRooms.has(room),
        };
      } else {
        result[id] = { online: false };
      }
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  res.writeHead(404);
  res.end();
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`SoundZone token server running on port ${PORT}`);
});
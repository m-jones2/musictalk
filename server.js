const { AccessToken } = require('livekit-server-sdk');
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
      delete activeUsers[userId];
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
    if (userId && pushToken) {
      pushTokens[userId] = pushToken;
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
          title: '🎵 MusicTalk Invite',
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
      delete activeUsers[userId];
    }
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
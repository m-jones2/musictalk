const { AccessToken } = require('livekit-server-sdk');
const http = require('http');
const url = require('url');

const API_KEY = 'API8pH7DjdozgXn';
const API_SECRET = 'hfOoTA56befhe6yrAduoDJRVBt4fFIuJuKcMf6C3GwKN';

const activeUsers = {};
// { userId: { room, displayName, lastSeen } }

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

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
        result[id] = { online: true, room: activeUsers[id].room, displayName: activeUsers[id].displayName };
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
  console.log(`MusicTalk token server running on port ${PORT}`);
});
const { AccessToken } = require('livekit-server-sdk');
const http = require('http');
const url = require('url');

const API_KEY = 'API8pH7DjdozgXn';
const API_SECRET = 'hfOoTA56befhe6yrAduoDJRVBt4fFIuJuKcMf6C3GwKN';

// Track who is currently in a room
const activeUsers = {};
// { username: { room: 'ROOMCODE', joinedAt: timestamp } }

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
    const userName = params.user || 'user-' + Math.random().toString(36).substring(2, 6);

    // Check user in
    activeUsers[userName] = { room: roomName, joinedAt: Date.now() };

    const token = new AccessToken(API_KEY, API_SECRET, {
      identity: userName,
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ token: jwt }));
    return;
  }

  // Check out (leave room)
  if (path === '/leave') {
    const userName = params.user;
    if (userName && activeUsers[userName]) {
      delete activeUsers[userName];
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // Get status of specific users
  if (path === '/status') {
    const names = params.names ? params.names.split(',') : [];
    const result = {};
    names.forEach(name => {
      if (activeUsers[name]) {
        result[name] = { online: true, room: activeUsers[name].room };
      } else {
        result[name] = { online: false };
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
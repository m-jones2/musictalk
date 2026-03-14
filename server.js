const { AccessToken } = require('livekit-server-sdk');
const http = require('http');
const url = require('url');

const API_KEY = 'API8pH7DjdozgXn';
const API_SECRET = 'hfOoTA56befhe6yrAduoDJRVBt4fFIuJuKcMf6C3GwKN';

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const params = url.parse(req.url, true).query;
  const roomName = params.room || 'default-room';
  const userName = params.user || 'user-' + Math.random().toString(36).substring(2, 6);

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
});

server.listen(3000, () => {
  console.log('MusicTalk token server running on http://localhost:3000');
});
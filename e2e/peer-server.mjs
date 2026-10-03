// Local stand-in for the public PeerJS signaling cloud (sandbox can't reach it).
import http from 'node:http';
import express from 'express';
import { ExpressPeerServer } from 'peer';
const app = express();
const server = http.createServer(app);
app.use('/', ExpressPeerServer(server, { path: '/', allow_discovery: false }));
server.listen(9000, '127.0.0.1', () => console.log('peer signaling on 9000'));

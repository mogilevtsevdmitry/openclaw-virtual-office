const { io } = require('socket.io-client');

const socket = io('http://localhost:3000/realtime', {
  transports: ['websocket'],
  timeout: 5000,
});

socket.on('connect', () => {
  console.log('WS TCP connected, socket id:', socket.id);
});

socket.on('connected', (data) => {
  console.log('WS Server ACK connected:', JSON.stringify(data));
  socket.emit('subscribe', { tenantId: 'tenant-test-001', floorId: 'floor-1' });
});

socket.on('subscribed', (data) => {
  console.log('WS Subscribed:', JSON.stringify(data));
  socket.emit('ping', {});
});

socket.on('pong', (data) => {
  console.log('WS Pong received:', JSON.stringify(data));
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (err) => {
  console.error('WS Connect Error:', err.message);
  process.exit(1);
});

socket.on('error', (err) => {
  console.error('WS Error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.error('WS Timeout - no response in 7s');
  process.exit(1);
}, 7000);

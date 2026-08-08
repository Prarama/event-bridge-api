const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`[EventBridge Server] Listening on port: ${PORT}`);
  console.log(`Mode: Development`);
  console.log(`Data Storage: In-Memory (Resets on restart)`);
  console.log(`======================================================\n`);
});

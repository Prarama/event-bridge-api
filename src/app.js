require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');

const app = express();

// Parse JSON request bodies
app.use(express.json());

// API Base Route
app.get('/', (req, res) => {
  return res.status(200).json({
    message: 'Welcome to the EventBridge API!',
    documentation: 'Use POST /register, POST /login, GET/POST/PUT/DELETE /events, POST /events/:id/register'
  });
});

// Mount Routes
app.use('/', authRoutes); // mounts POST /register and POST /login
app.use('/events', eventRoutes); // mounts GET, POST, PUT, DELETE /events and /events/:id/register

// Catch-all 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Generic Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'An unexpected internal server error occurred.',
  });
});

module.exports = app;

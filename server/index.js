require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const MongoDB = require('./config/mongodb');

const app = express();

// Initialize MongoDB connection (async, but don't block server startup)
MongoDB.connect().catch(err => {
  console.log('MongoDB connection failed, insights features will be unavailable:', err.message);
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/agents', require('./routes/agents'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/subaccounts', require('./routes/subaccounts'));
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/insights', require('./routes/insights'));

// Queue health endpoint
app.get('/api/queue/stats', (req, res) => {
  const queue = require('./services/analysisQueue');
  res.json({ success: true, data: queue.getStats() });
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Voice Campaign Platform running on port ${PORT}`);
  console.log(`📡 Bolna API: ${process.env.BOLNA_API_BASE || 'https://api.bolna.ai'}`);
});

module.exports = app;

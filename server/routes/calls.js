const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { prepare } = require('../db');
const bolna = require('../bolna');

router.post('/make', async (req, res) => {
  try {
    const { agent_id, recipient_phone, from_phone, user_data } = req.body;
    if (!agent_id || !recipient_phone)
      return res.status(400).json({ success: false, error: 'agent_id and recipient_phone are required' });

    const apiKey = req.headers['x-bolna-api-key'] || process.env.BOLNA_API_KEY;
    const result = await bolna.makeCall(agent_id, recipient_phone, from_phone, user_data, apiKey);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/execution/:executionId', async (req, res) => {
  try {
    const apiKey = req.headers['x-bolna-api-key'] || process.env.BOLNA_API_KEY;
    const execution = await bolna.getExecution(req.params.executionId, apiKey);
    res.json({ success: true, data: execution });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/logs/:campaignId', async (req, res) => {
  try {
    const logs = await prepare(
      `SELECT * FROM call_logs WHERE campaign_id = ? ORDER BY received_at DESC LIMIT 100`
    ).all(req.params.campaignId) || [];
    res.json({ success: true, data: Array.isArray(logs) ? logs : [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

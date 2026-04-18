const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { prepare } = require('../db');
const bolna = require('../bolna');

router.get('/', async (req, res) => {
  try {
    const accounts = await prepare('SELECT * FROM subaccounts ORDER BY created_at DESC').all() || [];
    res.json({ success: true, data: Array.isArray(accounts) ? accounts : [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, concurrency = 5 } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });

    const apiKey = req.headers['x-bolna-api-key'] || process.env.BOLNA_API_KEY;
    let bolnaSubId = null, bolnaApiKey = null;

    try {
      const result = await bolna.createSubAccount(parseInt(concurrency), apiKey);
      bolnaSubId  = result.id;
      bolnaApiKey = result.sub_account_api_key;
    } catch (e) {
      console.error('Bolna sub-account error:', e.message);
    }

    const id = uuidv4();
    await prepare(`
      INSERT INTO subaccounts (id, bolna_sub_account_id, bolna_api_key, name, email, concurrency)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, bolnaSubId, bolnaApiKey, name, email || '', parseInt(concurrency));

    res.json({ success: true, data: { id, bolna_sub_account_id: bolnaSubId, bolna_api_key: bolnaApiKey, name, email, concurrency } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/usage', async (req, res) => {
  try {
    const account = await prepare('SELECT * FROM subaccounts WHERE id = ?').get(req.params.id);
    if (!account) return res.status(404).json({ success: false, error: 'Sub-account not found' });

    const apiKey = req.headers['x-bolna-api-key'] || process.env.BOLNA_API_KEY;
    let bolnaUsage = null;
    if (account.bolna_sub_account_id) {
      try { bolnaUsage = await bolna.getSubAccountUsage(account.bolna_sub_account_id, apiKey); }
      catch (e) { console.error('Usage fetch error:', e.message); }
    }

    res.json({ success: true, data: { account, bolna_usage: bolnaUsage } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

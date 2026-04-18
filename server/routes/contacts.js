const express = require('express');
const router = express.Router();
const { prepare } = require('../db');

router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM contacts WHERE campaign_id = ?';
    const params = [req.params.campaignId];

    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY called_at DESC NULLS LAST LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const contacts = await prepare(sql).all(...params) || [];

    let countSql = 'SELECT COUNT(*) AS count FROM contacts WHERE campaign_id = ?';
    const countParams = [req.params.campaignId];
    if (status) { countSql += ' AND status = ?'; countParams.push(status); }
    const totalRow = await prepare(countSql).get(...countParams) || { count: 0 };

    res.json({
      success: true,
      data: Array.isArray(contacts) ? contacts : [],
      total: parseInt(totalRow.count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const contact = await prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });
    res.json({ success: true, data: contact });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { prepare } = require('../db');

router.get('/overview', async (req, res) => {
  try {
    const stats = await prepare(`
      SELECT
        COUNT(DISTINCT c.id)                                                        AS total_campaigns,
        COUNT(ct.id)                                                                AS total_calls,
        SUM(CASE WHEN ct.status = 'completed'  THEN 1 ELSE 0 END)                  AS completed_calls,
        SUM(CASE WHEN ct.status = 'failed'     THEN 1 ELSE 0 END)                  AS failed_calls,
        SUM(CASE WHEN ct.status = 'no-answer'  THEN 1 ELSE 0 END)                  AS no_answer_calls,
        COALESCE(SUM(ct.call_cost), 0)                                              AS total_cost,
        COALESCE(SUM(ct.call_duration), 0)                                          AS total_duration,
        COALESCE(AVG(CASE WHEN ct.call_duration > 0 THEN ct.call_duration END), 0)  AS avg_duration
      FROM campaigns c
      LEFT JOIN contacts ct ON ct.campaign_id = c.id
    `).get() || {};

    const recentCampaigns = await prepare(`
      SELECT id, name, status, created_at,
        (SELECT COUNT(*) FROM contacts WHERE campaign_id = campaigns.id)                              AS total_contacts,
        (SELECT COUNT(*) FROM contacts WHERE campaign_id = campaigns.id AND status = 'completed')     AS completed
      FROM campaigns ORDER BY created_at DESC LIMIT 5
    `).all() || [];

    const callsByStatus = await prepare(`
      SELECT status, COUNT(*) AS count
      FROM contacts
      WHERE status IS NOT NULL AND status != ''
      GROUP BY status
    `).all() || [];

    const costByDay = await prepare(`
      SELECT DATE(billed_at) AS date,
             SUM(total_cost) AS cost,
             COUNT(*)        AS calls
      FROM billing
      WHERE billed_at IS NOT NULL
      GROUP BY DATE(billed_at)
      ORDER BY date DESC
      LIMIT 30
    `).all() || [];

    res.json({
      success: true,
      data: {
        stats,
        recentCampaigns: Array.isArray(recentCampaigns) ? recentCampaigns : [],
        callsByStatus:   Array.isArray(callsByStatus)   ? callsByStatus   : [],
        costByDay:       Array.isArray(costByDay)       ? costByDay       : [],
      },
    });
  } catch (err) {
    console.error('Analytics overview error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    const stats = await prepare(`
      SELECT
        COUNT(*)                                                                      AS total,
        SUM(CASE WHEN status = 'completed'   THEN 1 ELSE 0 END)                      AS completed,
        SUM(CASE WHEN status = 'failed'      THEN 1 ELSE 0 END)                      AS failed,
        SUM(CASE WHEN status = 'no-answer'   THEN 1 ELSE 0 END)                      AS no_answer,
        SUM(CASE WHEN status = 'busy'        THEN 1 ELSE 0 END)                      AS busy,
        SUM(CASE WHEN status = 'pending'     THEN 1 ELSE 0 END)                      AS pending,
        SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END)                      AS in_progress,
        COALESCE(SUM(call_cost), 0)                                                   AS total_cost,
        COALESCE(SUM(call_duration), 0)                                               AS total_duration,
        COALESCE(AVG(CASE WHEN call_duration > 0 THEN call_duration END), 0)          AS avg_duration,
        COALESCE(MAX(call_duration), 0)                                               AS max_duration
      FROM contacts WHERE campaign_id = ?
    `).get(campaignId) || {};

    const answerRate = stats.total > 0
      ? ((stats.completed / stats.total) * 100).toFixed(1)
      : 0;

    const hourlyDist = await prepare(`
      SELECT EXTRACT(HOUR FROM called_at)::int AS hour, COUNT(*) AS count
      FROM contacts
      WHERE campaign_id = ? AND called_at IS NOT NULL
      GROUP BY hour ORDER BY hour
    `).all(campaignId) || [];

    res.json({
      success: true,
      data: {
        stats: { ...stats, answer_rate: answerRate },
        hourlyDist: Array.isArray(hourlyDist) ? hourlyDist : [],
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

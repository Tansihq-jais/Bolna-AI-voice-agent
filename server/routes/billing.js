const express = require('express');
const router = express.Router();
const { prepare } = require('../db');

// Monthly tiered pricing (INR per minute)
// The rate that applies is determined by total calls in the month
// < 5,000  calls → ₹10/min  (entire month)
// < 10,000 calls → ₹8/min   (entire month)
// ≥ 10,000 calls → ₹6.4/min (entire month)
function getMonthlyRate(totalCalls) {
  if (totalCalls >= 10000) return { rate: 6.4, tier: 'Pro' };
  if (totalCalls >= 5000)  return { rate: 8,   tier: 'Standard' };
  return                          { rate: 10,  tier: 'Starter' };
}

// Returns YYYY-MM for a given date, defaults to current month
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

router.get('/summary', async (req, res) => {
  try {
    const month = req.query.month || currentMonth(); // e.g. "2026-04"

    // This month's usage
    const monthly = await prepare(`
      SELECT
        COUNT(*)                            AS total_calls,
        COALESCE(SUM(duration_seconds), 0) AS total_seconds
      FROM billing
      WHERE strftime('%Y-%m', billed_at) = ?
    `).get(month) || {};

    const totalCalls   = monthly.total_calls   || 0;
    const totalSeconds = monthly.total_seconds || 0;
    const totalMinutes = totalSeconds / 60;
    const { rate, tier } = getMonthlyRate(totalCalls);
    const totalCost = parseFloat((totalMinutes * rate).toFixed(2));

    // Calls needed to hit next tier
    let nextTierInfo = null;
    if (totalCalls < 5000)  nextTierInfo = `${(5000  - totalCalls).toLocaleString()} more calls this month to drop to ₹8/min`;
    else if (totalCalls < 10000) nextTierInfo = `${(10000 - totalCalls).toLocaleString()} more calls this month to drop to ₹6.4/min`;

    // Per-campaign breakdown for this month
    const byCampaign = await prepare(`
      SELECT b.campaign_id, c.name AS campaign_name,
        COUNT(*)                              AS calls,
        COALESCE(SUM(b.duration_seconds), 0) AS total_seconds
      FROM billing b
      LEFT JOIN campaigns c ON c.id = b.campaign_id
      WHERE strftime('%Y-%m', b.billed_at) = ?
      GROUP BY b.campaign_id, c.name
      ORDER BY total_seconds DESC
    `).all(month) || [];

    const byCampaignWithCost = (Array.isArray(byCampaign) ? byCampaign : []).map(c => ({
      campaign_id:   c.campaign_id,
      campaign_name: c.campaign_name,
      calls:         c.calls,
      total_minutes: parseFloat((c.total_seconds / 60).toFixed(2)),
      total_cost:    parseFloat(((c.total_seconds / 60) * rate).toFixed(2)),
    }));

    // Daily breakdown for chart
    const daily = await prepare(`
      SELECT DATE(billed_at) AS date,
             COUNT(*)        AS calls,
             COALESCE(SUM(duration_seconds), 0) AS total_seconds
      FROM billing
      WHERE strftime('%Y-%m', billed_at) = ?
      GROUP BY DATE(billed_at)
      ORDER BY date ASC
    `).all(month) || [];

    const dailyWithCost = (Array.isArray(daily) ? daily : []).map(d => ({
      date:  d.date,
      calls: d.calls,
      // Running cost uses the month-end rate (same rate applies to all days)
      cost:  parseFloat(((d.total_seconds / 60) * rate).toFixed(2)),
    }));

    // Available months for the month picker
    const months = await prepare(`
      SELECT DISTINCT strftime('%Y-%m', billed_at) AS month
      FROM billing
      ORDER BY month DESC
    `).all() || [];

    res.json({
      success: true,
      data: {
        month,
        summary: {
          total_calls:   totalCalls,
          total_minutes: parseFloat(totalMinutes.toFixed(2)),
          total_cost:    totalCost,
          rate_per_min:  rate,
        },
        tier: { name: tier, rate_per_min: rate, next_tier_info: nextTierInfo },
        byCampaign: byCampaignWithCost,
        daily:      dailyWithCost,
        availableMonths: (Array.isArray(months) ? months : []).map(m => m.month),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const month = req.query.month || currentMonth();

    const summary = await prepare(`
      SELECT COUNT(*) AS calls,
        COALESCE(SUM(duration_seconds), 0) AS total_seconds
      FROM billing WHERE campaign_id = ? AND strftime('%Y-%m', billed_at) = ?
    `).get(req.params.campaignId, month) || {};

    // Get month total to determine rate
    const monthTotal = await prepare(`
      SELECT COUNT(*) AS total_calls FROM billing WHERE strftime('%Y-%m', billed_at) = ?
    `).get(month) || {};

    const { rate } = getMonthlyRate(monthTotal.total_calls || 0);
    const totalMinutes = (summary.total_seconds || 0) / 60;

    res.json({
      success: true,
      data: {
        summary: {
          calls:         summary.calls || 0,
          total_minutes: parseFloat(totalMinutes.toFixed(2)),
          total_cost:    parseFloat((totalMinutes * rate).toFixed(2)),
          rate_per_min:  rate,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/estimate', (req, res) => {
  try {
    const { num_contacts, avg_duration_min = 2 } = req.body;
    const contacts = parseInt(num_contacts)       || 0;
    const duration = parseFloat(avg_duration_min) || 2;

    // Get current month's call count to project final total
    const month = currentMonth();
    const monthTotal = prepare(`
      SELECT COUNT(*) AS total_calls FROM billing WHERE strftime('%Y-%m', billed_at) = ?
    `).get(month) || {};

    const projectedTotal = (monthTotal.total_calls || 0) + contacts;
    const { rate, tier } = getMonthlyRate(projectedTotal);
    const totalMinutes = contacts * duration;
    const totalCost    = parseFloat((totalMinutes * rate).toFixed(2));

    res.json({
      success: true,
      data: {
        contacts,
        avg_duration_min:  duration,
        projected_calls:   projectedTotal,
        total_cost:        totalCost,
        per_call:          contacts > 0 ? parseFloat((totalCost / contacts).toFixed(2)) : 0,
        rate_per_min:      rate,
        tier,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

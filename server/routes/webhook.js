const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { prepare } = require('../db');
const analysisQueue = require('../services/analysisQueue');
const MongoDB = require('../config/mongodb');

const BOLNA_BASE_COST = parseFloat(process.env.BOLNA_BASE_COST_PER_MIN) || 0.02;
const PLATFORM_MARKUP = parseFloat(process.env.PLATFORM_MARKUP_PER_MIN) || 0.02;

router.post('/bolna/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const payload = req.body;
    const executionId = payload.id || payload.execution_id;
    const status = payload.status;

    console.log(`📞 Webhook [${campaignId}]:`, status, executionId);

    // Log raw event
    await prepare(`
      INSERT INTO call_logs (id, campaign_id, execution_id, status, event_data)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), campaignId, executionId, status, JSON.stringify(payload));

    if (!executionId) return res.json({ received: true });

    // Find contact
    let contact = await prepare(
      'SELECT * FROM contacts WHERE execution_id = ? AND campaign_id = ?'
    ).get(executionId, campaignId);

    if (!contact && payload.telephony_data?.to_number) {
      contact = await prepare(
        `SELECT * FROM contacts WHERE contact_number = ? AND campaign_id = ? AND status = 'pending' LIMIT 1`
      ).get(payload.telephony_data.to_number, campaignId);
    }

    if (contact) {
      const duration = payload.conversation_time || 0;
      const bolnaCost = payload.total_cost || 0;
      const platformCost = (duration / 60) * PLATFORM_MARKUP;
      const totalCost = bolnaCost + platformCost;
      const mappedStatus = mapStatus(status);
      const isTerminal = ['completed', 'failed', 'no-answer', 'busy', 'error'].includes(mappedStatus);

      await prepare(`
        UPDATE contacts SET
          status = ?, execution_id = ?, call_duration = ?, call_cost = ?,
          hangup_reason = ?,
          called_at = COALESCE(called_at, NOW()),
          completed_at = CASE WHEN ? THEN NOW() ELSE completed_at END
        WHERE id = ?
      `).run(
        mappedStatus, executionId, duration, totalCost,
        payload.telephony_data?.hangup_reason || '',
        isTerminal, contact.id
      );

      // Billing for completed calls
      if (mappedStatus === 'completed' && duration > 0) {
        await prepare(`
          INSERT INTO billing (id, campaign_id, execution_id, contact_number, duration_seconds, bolna_cost, platform_cost, total_cost, cost_breakdown)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO NOTHING
        `).run(
          uuidv4(), campaignId, executionId,
          payload.telephony_data?.to_number || contact.contact_number,
          duration, bolnaCost, platformCost, totalCost,
          JSON.stringify(payload.usage_breakdown || {})
        );
      }

      // Enqueue insight analysis — webhook returns immediately, analysis runs async
      if (isTerminal && duration > 0 && MongoDB.isConnected()) {
        const campaign = await prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
        analysisQueue.enqueue({
          campaignId,
          contactId:     contact.id,
          executionId,
          contactNumber: contact.contact_number,
          contactName:   contact.name,
          transcript:    payload.transcript || '',   // passed to analyzer, never stored
          callDuration:  duration,
          callStatus:    mappedStatus,
          hangupReason:  payload.telephony_data?.hangup_reason || '',
          callCost:      totalCost,
          extractedData: payload.extracted_data || {},
          agentId:       campaign?.agent_id   || '',
          agentName:     campaign?.agent_name || '',
          campaignName:  campaign?.name       || '',
        });
      }
    }

    // Mark campaign complete if all contacts are done
    const stats = await prepare(`
      SELECT
        SUM(CASE WHEN status IN ('completed','failed','no-answer','busy','error') THEN 1 ELSE 0 END) AS done,
        COUNT(*) AS total
      FROM contacts WHERE campaign_id = ?
    `).get(campaignId);

    if (stats && stats.done >= stats.total && stats.total > 0) {
      await prepare(
        `UPDATE campaigns SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = ?`
      ).run(campaignId);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

function mapStatus(s) {
  const map = {
    completed: 'completed', failed: 'failed', 'no-answer': 'no-answer',
    busy: 'busy', error: 'failed', 'in-progress': 'in-progress',
    queued: 'pending', initiated: 'pending', ringing: 'in-progress',
    'call-disconnected': 'in-progress', canceled: 'failed', stopped: 'failed',
  };
  return map[s] || s;
}

module.exports = router;

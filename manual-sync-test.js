#!/usr/bin/env node
/**
 * Manual Sync Test - Fetch transcriptions and call details from Bolna
 * This script manually syncs a campaign to verify data fetching works
 */

require('dotenv').config();
const bolna = require('./server/bolna');
const { prepare } = require('./server/db');

const API_KEY = process.env.BOLNA_API_KEY;

async function syncCampaign(campaignId) {
  console.log('\n🔄 Starting manual sync for campaign:', campaignId);
  
  try {
    // Get campaign from database
    const campaign = await prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    
    if (!campaign) {
      console.error('❌ Campaign not found');
      return;
    }
    
    console.log('✓ Campaign found:', campaign.name);
    console.log('  Batch ID:', campaign.batch_id);
    console.log('  Status:', campaign.status);
    
    if (!campaign.batch_id) {
      console.error('❌ No batch_id found for this campaign');
      return;
    }
    
    // Fetch batch data from Bolna
    console.log('\n📊 Fetching batch data from Bolna...');
    const batchData = await bolna.getBatch(campaign.batch_id, API_KEY);
    console.log('✓ Batch Status:', batchData.status);
    console.log('  Total Calls:', batchData.total_calls || 0);
    
    // Fetch executions
    console.log('\n📞 Fetching executions from Bolna...');
    const executions = await bolna.getBatchExecutions(campaign.batch_id, API_KEY);
    console.log('✓ Found', executions.length, 'executions');
    
    if (executions.length === 0) {
      console.log('⚠ No executions to sync');
      return;
    }
    
    // Process each execution
    console.log('\n🔄 Processing executions...\n');
    let updated = 0;
    let withTranscripts = 0;
    
    for (const exec of executions) {
      const phoneNumber = exec.user_number || exec.context_details?.recipient_phone_number;
      
      if (!phoneNumber) {
        console.log('⚠ Skipping execution without phone number:', exec.id);
        continue;
      }
      
      console.log(`\n📱 Processing: ${phoneNumber}`);
      console.log('   Execution ID:', exec.id);
      console.log('   Status:', exec.status);
      console.log('   Duration:', exec.conversation_time || 0, 'seconds');
      console.log('   Cost: $', exec.total_cost || 0);
      
      // Check for transcript
      if (exec.transcript) {
        withTranscripts++;
        console.log('   ✓ Transcript:', exec.transcript.length, 'characters');
        console.log('   Preview:', exec.transcript.substring(0, 100) + '...');
      } else {
        console.log('   ⚠ No transcript available');
      }
      
      // Check for extracted data
      if (exec.extracted_data) {
        console.log('   ✓ Extracted Data:', JSON.stringify(exec.extracted_data).substring(0, 100));
      }
      
      // Check for telephony data
      if (exec.telephony_data) {
        console.log('   ✓ Telephony Data:');
        console.log('     - To:', exec.telephony_data.to_number);
        console.log('     - Hangup:', exec.telephony_data.hangup_reason || 'N/A');
        if (exec.telephony_data.recording_url) {
          console.log('     - Recording:', exec.telephony_data.recording_url);
        }
      }
      
      // Find or create contact in database
      let contact = await prepare(
        'SELECT * FROM contacts WHERE campaign_id = ? AND contact_number = ?'
      ).get(campaignId, phoneNumber);
      
      const duration = Math.round(exec.conversation_duration || parseInt(exec.telephony_data?.duration || 0));
      const cost = exec.total_cost || 0;
      
      if (contact) {
        // Update existing contact
        await prepare(`
          UPDATE contacts SET 
            status = ?,
            execution_id = ?,
            call_duration = ?,
            call_cost = ?,
            hangup_reason = ?,
            recording_url = ?,
            summary = ?,
            completed_at = CASE WHEN ? IN ('completed','failed','no-answer','busy') THEN COALESCE(completed_at, NOW()) ELSE completed_at END
          WHERE id = ?
        `).run(
          exec.status,
          exec.id,
          duration,
          cost,
          exec.telephony_data?.hangup_reason || '',
          exec.telephony_data?.recording_url || null,
          exec.summary || null,
          exec.status,
          contact.id
        );
        console.log('   ✓ Updated contact in database');
        updated++;
      } else {
        // Create new contact
        const { v4: uuidv4 } = require('uuid');
        await prepare(`
          INSERT INTO contacts (id, campaign_id, contact_number, name, status, execution_id, call_duration, call_cost, hangup_reason, recording_url, summary)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          campaignId,
          phoneNumber,
          exec.context_details?.recipient_data?.name || '',
          exec.status,
          exec.id,
          duration,
          cost,
          exec.telephony_data?.hangup_reason || '',
          exec.telephony_data?.recording_url || null,
          exec.summary || null
        );
        console.log('   ✓ Created new contact in database');
        updated++;
      }
    }
    
    // Update campaign status
    const newStatus = batchData.status === 'completed' ? 'completed' : 
                      batchData.status === 'stopped' ? 'stopped' : 'running';
    await prepare('UPDATE campaigns SET status = ?, updated_at = NOW() WHERE id = ?')
      .run(newStatus, campaignId);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ SYNC COMPLETED');
    console.log('='.repeat(60));
    console.log('Total Executions:', executions.length);
    console.log('Contacts Updated:', updated);
    console.log('With Transcripts:', withTranscripts, `(${Math.round(withTranscripts/executions.length*100)}%)`);
    console.log('Campaign Status:', newStatus);
    console.log('='.repeat(60) + '\n');
    
  } catch (err) {
    console.error('\n❌ Sync failed:', err.message);
    console.error(err);
  }
}

// Get campaign ID from command line or use most recent
async function main() {
  const campaignId = process.argv[2];
  
  if (campaignId) {
    await syncCampaign(campaignId);
  } else {
    console.log('📋 No campaign ID provided, using most recent campaign with batch_id...\n');
    const campaign = await prepare(
      'SELECT * FROM campaigns WHERE batch_id IS NOT NULL ORDER BY created_at DESC LIMIT 1'
    ).get();
    
    if (!campaign) {
      console.error('❌ No campaigns with batch_id found');
      console.log('\nUsage: node manual-sync-test.js [campaign_id]');
      process.exit(1);
    }
    
    await syncCampaign(campaign.id);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Bolna Integration Test Suite
 * Tests transcription fetching, call details updates, and webhook processing
 */

require('dotenv').config();
const bolna = require('./server/bolna');
const { prepare } = require('./server/db');
const axios = require('axios');

const API_KEY = process.env.BOLNA_API_KEY;
const BASE_URL = process.env.BOLNA_API_BASE || 'https://api.bolna.ai';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'blue');
  console.log('='.repeat(60));
}

async function testBolnaConnection() {
  section('TEST 1: Bolna API Connection');
  try {
    const userInfo = await bolna.getUserInfo(API_KEY);
    log('✓ Successfully connected to Bolna API', 'green');
    log(`  User: ${userInfo.email || 'N/A'}`, 'gray');
    log(`  Credits: ${userInfo.credits || 'N/A'}`, 'gray');
    return true;
  } catch (err) {
    log('✗ Failed to connect to Bolna API', 'red');
    log(`  Error: ${err.message}`, 'red');
    return false;
  }
}

async function testAgentRetrieval() {
  section('TEST 2: Agent Retrieval');
  try {
    const agents = await bolna.listAgents(API_KEY);
    log(`✓ Retrieved ${agents.length || 0} agents from Bolna`, 'green');
    
    if (agents.length > 0) {
      const agent = agents[0];
      // Try different possible field names
      const agentId = agent.agent_id || agent.id || agent.agentId;
      const agentName = agent.agent_name || agent.name || agent.agentName;
      
      log(`  Sample Agent ID: ${agentId || 'N/A'}`, 'gray');
      log(`  Agent Name: ${agentName || 'N/A'}`, 'gray');
      
      if (agentId) {
        try {
          // Test getting single agent details
          const agentDetails = await bolna.getAgent(agentId, API_KEY);
          log(`✓ Successfully fetched agent details`, 'green');
          return agentId;
        } catch (err) {
          log(`⚠ Could not fetch agent details: ${err.message}`, 'yellow');
          return agentId; // Return ID anyway for other tests
        }
      }
      return agentId;
    } else {
      log('  No agents found in account', 'yellow');
      return null;
    }
  } catch (err) {
    log('✗ Failed to retrieve agents', 'red');
    log(`  Error: ${err.message}`, 'red');
    return null;
  }
}

async function testExecutionRetrieval(agentId) {
  section('TEST 3: Execution & Transcription Retrieval');
  
  if (!agentId) {
    log('⊘ Skipping - no agent ID available', 'yellow');
    return null;
  }

  try {
    const executions = await bolna.getAgentExecutions(agentId, 1, 10, API_KEY);
    log(`✓ Retrieved ${executions.length || 0} executions`, 'green');
    
    if (executions.length > 0) {
      const exec = executions[0];
      log(`\n  Execution Details:`, 'blue');
      log(`    ID: ${exec.id}`, 'gray');
      log(`    Status: ${exec.status}`, 'gray');
      log(`    Duration: ${exec.conversation_time || 0}s`, 'gray');
      log(`    Cost: $${exec.total_cost || 0}`, 'gray');
      
      // Check for transcription
      if (exec.transcript) {
        log(`    ✓ Transcript available (${exec.transcript.length} chars)`, 'green');
        log(`    Preview: "${exec.transcript.substring(0, 100)}..."`, 'gray');
      } else {
        log(`    ⚠ No transcript available`, 'yellow');
      }
      
      // Check for extracted data
      if (exec.extracted_data) {
        log(`    ✓ Extracted data available`, 'green');
        log(`    Data: ${JSON.stringify(exec.extracted_data).substring(0, 100)}...`, 'gray');
      }
      
      // Check telephony data
      if (exec.telephony_data) {
        log(`    ✓ Telephony data available`, 'green');
        log(`    To: ${exec.telephony_data.to_number || 'N/A'}`, 'gray');
        log(`    Hangup: ${exec.telephony_data.hangup_reason || 'N/A'}`, 'gray');
        if (exec.telephony_data.recording_url) {
          log(`    Recording URL: ${exec.telephony_data.recording_url}`, 'gray');
        }
      }
      
      return exec.id;
    } else {
      log('  No executions found for this agent', 'yellow');
      return null;
    }
  } catch (err) {
    log('✗ Failed to retrieve executions', 'red');
    log(`  Error: ${err.message}`, 'red');
    return null;
  }
}

async function testSingleExecutionFetch(executionId) {
  section('TEST 4: Single Execution Detailed Fetch');
  
  if (!executionId) {
    log('⊘ Skipping - no execution ID available', 'yellow');
    return;
  }

  try {
    const execution = await bolna.getExecution(executionId, API_KEY);
    log('✓ Successfully fetched execution details', 'green');
    
    log(`\n  Complete Execution Data:`, 'blue');
    log(`    Status: ${execution.status}`, 'gray');
    log(`    Conversation Time: ${execution.conversation_time || 0}s`, 'gray');
    log(`    Total Cost: $${execution.total_cost || 0}`, 'gray');
    
    // Verify all critical fields
    const checks = [
      { field: 'transcript', value: execution.transcript, label: 'Transcript' },
      { field: 'extracted_data', value: execution.extracted_data, label: 'Extracted Data' },
      { field: 'telephony_data', value: execution.telephony_data, label: 'Telephony Data' },
      { field: 'usage_breakdown', value: execution.usage_breakdown, label: 'Usage Breakdown' },
    ];
    
    log(`\n  Field Availability Check:`, 'blue');
    checks.forEach(check => {
      if (check.value) {
        log(`    ✓ ${check.label}: Available`, 'green');
      } else {
        log(`    ✗ ${check.label}: Missing`, 'red');
      }
    });
    
    return execution;
  } catch (err) {
    log('✗ Failed to fetch execution details', 'red');
    log(`  Error: ${err.message}`, 'red');
  }
}

async function testBatchRetrieval() {
  section('TEST 5: Batch & Campaign Data Retrieval');
  
  try {
    // Get a campaign with batch_id from database
    const campaign = await prepare(
      'SELECT * FROM campaigns WHERE batch_id IS NOT NULL ORDER BY created_at DESC LIMIT 1'
    ).get();
    
    if (!campaign) {
      log('⊘ No campaigns with batch_id found in database', 'yellow');
      return;
    }
    
    log(`✓ Found campaign: ${campaign.name}`, 'green');
    log(`  Campaign ID: ${campaign.id}`, 'gray');
    log(`  Batch ID: ${campaign.batch_id}`, 'gray');
    
    // Fetch batch details from Bolna
    const batchData = await bolna.getBatch(campaign.batch_id, API_KEY);
    log(`✓ Retrieved batch data from Bolna`, 'green');
    log(`  Status: ${batchData.status}`, 'gray');
    log(`  Total Calls: ${batchData.total_calls || 0}`, 'gray');
    
    // Fetch batch executions
    const executions = await bolna.getBatchExecutions(campaign.batch_id, API_KEY);
    log(`✓ Retrieved ${executions.length} executions for batch`, 'green');
    
    if (executions.length > 0) {
      const withTranscript = executions.filter(e => e.transcript).length;
      const withExtractedData = executions.filter(e => e.extracted_data).length;
      
      log(`\n  Execution Data Quality:`, 'blue');
      log(`    Total Executions: ${executions.length}`, 'gray');
      log(`    With Transcripts: ${withTranscript} (${Math.round(withTranscript/executions.length*100)}%)`, 
          withTranscript > 0 ? 'green' : 'red');
      log(`    With Extracted Data: ${withExtractedData} (${Math.round(withExtractedData/executions.length*100)}%)`, 
          withExtractedData > 0 ? 'green' : 'yellow');
    }
    
    return { campaign, batchData, executions };
  } catch (err) {
    log('✗ Failed to retrieve batch data', 'red');
    log(`  Error: ${err.message}`, 'red');
  }
}

async function testDatabaseSync() {
  section('TEST 6: Database Synchronization Check');
  
  try {
    // Get contacts with execution IDs
    const contacts = await prepare(
      'SELECT * FROM contacts WHERE execution_id IS NOT NULL ORDER BY called_at DESC LIMIT 5'
    ).all();
    
    if (!contacts || contacts.length === 0) {
      log('⊘ No contacts with execution IDs found', 'yellow');
      return;
    }
    
    log(`✓ Found ${contacts.length} contacts with execution IDs`, 'green');
    
    let syncedCount = 0;
    let transcriptCount = 0;
    
    for (const contact of contacts) {
      try {
        const execution = await bolna.getExecution(contact.execution_id, API_KEY);
        syncedCount++;
        
        log(`\n  Contact: ${contact.name || contact.contact_number}`, 'blue');
        log(`    DB Status: ${contact.status}`, 'gray');
        log(`    Bolna Status: ${execution.status}`, 'gray');
        log(`    DB Duration: ${contact.call_duration}s`, 'gray');
        log(`    Bolna Duration: ${execution.conversation_time || 0}s`, 'gray');
        
        // Check if transcript is in DB
        if (execution.transcript) {
          transcriptCount++;
          log(`    ✓ Transcript available from Bolna (${execution.transcript.length} chars)`, 'green');
        } else {
          log(`    ⚠ No transcript from Bolna`, 'yellow');
        }
        
        // Check data consistency
        if (contact.status !== execution.status) {
          log(`    ⚠ Status mismatch detected`, 'yellow');
        }
        if (Math.abs(contact.call_duration - (execution.conversation_time || 0)) > 5) {
          log(`    ⚠ Duration mismatch detected`, 'yellow');
        }
        
      } catch (err) {
        log(`    ✗ Failed to fetch execution: ${err.message}`, 'red');
      }
    }
    
    log(`\n  Sync Summary:`, 'blue');
    log(`    Successfully synced: ${syncedCount}/${contacts.length}`, 
        syncedCount === contacts.length ? 'green' : 'yellow');
    log(`    Transcripts available: ${transcriptCount}/${syncedCount}`, 
        transcriptCount > 0 ? 'green' : 'red');
    
  } catch (err) {
    log('✗ Database sync check failed', 'red');
    log(`  Error: ${err.message}`, 'red');
  }
}

async function testWebhookProcessing() {
  section('TEST 7: Webhook Processing Simulation');
  
  try {
    // Get a recent call log
    const callLog = await prepare(
      'SELECT * FROM call_logs ORDER BY received_at DESC LIMIT 1'
    ).get();
    
    if (!callLog) {
      log('⊘ No call logs found in database', 'yellow');
      return;
    }
    
    log('✓ Found recent webhook event', 'green');
    log(`  Campaign ID: ${callLog.campaign_id}`, 'gray');
    log(`  Execution ID: ${callLog.execution_id}`, 'gray');
    log(`  Status: ${callLog.status}`, 'gray');
    log(`  Received: ${callLog.received_at}`, 'gray');
    
    // Parse event data
    const eventData = typeof callLog.event_data === 'string' 
      ? JSON.parse(callLog.event_data) 
      : callLog.event_data;
    
    log(`\n  Webhook Payload Analysis:`, 'blue');
    
    const fields = [
      { key: 'transcript', label: 'Transcript' },
      { key: 'conversation_time', label: 'Duration' },
      { key: 'total_cost', label: 'Cost' },
      { key: 'extracted_data', label: 'Extracted Data' },
      { key: 'telephony_data', label: 'Telephony Data' },
      { key: 'usage_breakdown', label: 'Usage Breakdown' },
    ];
    
    fields.forEach(field => {
      if (eventData[field.key]) {
        log(`    ✓ ${field.label}: Present`, 'green');
        if (field.key === 'transcript') {
          log(`      Length: ${eventData[field.key].length} chars`, 'gray');
        }
      } else {
        log(`    ✗ ${field.label}: Missing`, 'red');
      }
    });
    
  } catch (err) {
    log('✗ Webhook processing test failed', 'red');
    log(`  Error: ${err.message}`, 'red');
  }
}

async function testCallLogsRetrieval() {
  section('TEST 8: Call Logs & History');
  
  try {
    const campaigns = await prepare(
      'SELECT id, name FROM campaigns ORDER BY created_at DESC LIMIT 3'
    ).all();
    
    if (!campaigns || campaigns.length === 0) {
      log('⊘ No campaigns found', 'yellow');
      return;
    }
    
    for (const campaign of campaigns) {
      const logs = await prepare(
        'SELECT * FROM call_logs WHERE campaign_id = ? ORDER BY received_at DESC LIMIT 5'
      ).all(campaign.id);
      
      log(`\n  Campaign: ${campaign.name}`, 'blue');
      log(`    Total Events: ${logs.length}`, 'gray');
      
      if (logs.length > 0) {
        const statuses = logs.map(l => l.status);
        const uniqueStatuses = [...new Set(statuses)];
        log(`    Event Types: ${uniqueStatuses.join(', ')}`, 'gray');
        
        // Check for transcripts in logs
        const logsWithTranscript = logs.filter(l => {
          const data = typeof l.event_data === 'string' ? JSON.parse(l.event_data) : l.event_data;
          return data.transcript;
        });
        
        log(`    Events with Transcript: ${logsWithTranscript.length}/${logs.length}`, 
            logsWithTranscript.length > 0 ? 'green' : 'yellow');
      }
    }
    
  } catch (err) {
    log('✗ Call logs retrieval failed', 'red');
    log(`  Error: ${err.message}`, 'red');
  }
}

async function runAllTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║     BOLNA INTEGRATION TEST SUITE                          ║', 'blue');
  log('║     Testing Transcription & Call Details Fetching         ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');
  
  const startTime = Date.now();
  
  // Run tests sequentially
  const connected = await testBolnaConnection();
  if (!connected) {
    log('\n⚠ Cannot proceed without Bolna API connection', 'red');
    process.exit(1);
  }
  
  const agentId = await testAgentRetrieval();
  const executionId = await testExecutionRetrieval(agentId);
  await testSingleExecutionFetch(executionId);
  await testBatchRetrieval();
  await testDatabaseSync();
  await testWebhookProcessing();
  await testCallLogsRetrieval();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  section('TEST SUMMARY');
  log(`✓ All tests completed in ${duration}s`, 'green');
  log('\nKey Findings:', 'blue');
  log('  • Check above for any ✗ (failed) or ⚠ (warning) indicators', 'gray');
  log('  • Transcripts should be available in completed calls', 'gray');
  log('  • Call details should sync between Bolna and local DB', 'gray');
  log('  • Webhook events should contain all necessary data', 'gray');
  
  console.log('\n');
}

// Run tests
runAllTests().catch(err => {
  log(`\n✗ Test suite failed: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});

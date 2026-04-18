const axios = require('axios');

const BOLNA_API_BASE = process.env.BOLNA_API_BASE || 'https://api.bolna.ai';

function getBolnaClient(apiKey) {
  return axios.create({
    baseURL: BOLNA_API_BASE,
    headers: {
      Authorization: `Bearer ${apiKey || process.env.BOLNA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

const bolna = {
  // Agents
  async listAgents(apiKey) {
    const client = getBolnaClient(apiKey);
    const res = await client.get('/v2/agent/all');
    return res.data;
  },

  async getAgent(agentId, apiKey) {
    const client = getBolnaClient(apiKey);
    const res = await client.get(`/v2/agent/${agentId}`);
    return res.data;
  },

  async createAgent(agentConfig, apiKey) {
    const client = getBolnaClient(apiKey);
    const res = await client.post('/v2/agent', agentConfig);
    return res.data;
  },

  async updateAgent(agentId, agentConfig, apiKey) {
    const client = getBolnaClient(apiKey);
    const res = await client.put(`/v2/agent/${agentId}`, agentConfig);
    return res.data;
  },

  async patchAgent(agentId, patch, apiKey) {
    const client = getBolnaClient(apiKey);
    const res = await client.patch(`/v2/agent/${agentId}`, patch);
    return res.data;
  },

  // Calls
  async makeCall(agentId, recipientPhone, fromPhone, userData, apiKey) {
    const client = getBolnaClient(apiKey);
    const payload = {
      agent_id: agentId,
      recipient_phone_number: recipientPhone,
    };
    if (fromPhone) payload.from_phone_number = fromPhone;
    if (userData) payload.user_data = userData;
    const res = await client.post('/call', payload);
    return res.data;
  },

  // Batches
  async createBatch(agentId, csvBuffer, filename, fromPhones, webhookUrl, retryConfig, apiKey) {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('agent_id', agentId);
    form.append('file', csvBuffer, { filename: filename || 'contacts.csv', contentType: 'text/csv' });
    if (fromPhones && fromPhones.length > 0) {
      fromPhones.forEach(p => form.append('from_phone_numbers', p));
    }
    if (webhookUrl) form.append('webhook_url', webhookUrl);
    if (retryConfig) form.append('retry_config', JSON.stringify(retryConfig));

    const client = axios.create({
      baseURL: BOLNA_API_BASE,
      headers: {
        Authorization: `Bearer ${apiKey || process.env.BOLNA_API_KEY}`,
        ...form.getHeaders(),
      },
      timeout: 60000,
    });
    const res = await client.post('/batches', form);
    return res.data;
  },

  async scheduleBatch(batchId, scheduledAt, apiKey) {
    const client = getBolnaClient(apiKey);
    const form = new (require('form-data'))();
    form.append('scheduled_at', scheduledAt);
    const res = await axios.post(`${BOLNA_API_BASE}/batches/${batchId}/schedule`, form, {
      headers: {
        Authorization: `Bearer ${apiKey || process.env.BOLNA_API_KEY}`,
        ...form.getHeaders(),
      },
    });
    return res.data;
  },

  async getBatch(batchId, apiKey) {
    const client = getBolnaClient(apiKey);
    const res = await client.get(`/batches/${batchId}`);
    return res.data;
  },

  async getBatchExecutions(batchId, apiKey) {
    const client = getBolnaClient(apiKey);
    const res = await client.get(`/batches/${batchId}/executions`);
    return res.data;
  },

  async stopBatch(batchId, apiKey) {
    const client = getBolnaClient(apiKey);
    const res = await client.post(`/batches/${batchId}/stop`);
    return res.data;
  },

  // Executions
  async getExecution(executionId, apiKey) {
    const client = getBolnaClient(apiKey);
    const res = await client.get(`/executions/${executionId}`);
    return res.data;
  },

  async getAgentExecutions(agentId, page = 1, pageSize = 50, apiKey) {
    const client = getBolnaClient(apiKey);
    const res = await client.get(`/v2/agent/${agentId}/executions`, {
      params: { page_number: page, page_size: pageSize },
    });
    return res.data;
  },

  // Sub-accounts
  async createSubAccount(concurrency, apiKey) {
    const client = getBolnaClient(apiKey);
    const res = await client.post('/sub-accounts/create', { allow_concurrent_calls: concurrency });
    return res.data;
  },

  async listSubAccounts(apiKey) {
    const client = getBolnaClient(apiKey);
    const res = await client.get('/sub-accounts/all');
    return res.data;
  },

  async getSubAccountUsage(subAccountId, apiKey) {
    const client = getBolnaClient(apiKey);
    const res = await client.get(`/sub-accounts/${subAccountId}/usage`);
    return res.data;
  },

  // User info
  async getUserInfo(apiKey) {
    const client = getBolnaClient(apiKey);
    const res = await client.get('/user/me');
    return res.data;
  },
};

module.exports = bolna;

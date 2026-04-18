const express = require('express');
const router = express.Router();
const bolna = require('../bolna');
const { buildAgentConfig, listTemplates, getTemplate } = require('../agentTemplates');

// List all agents from Bolna
router.get('/', async (req, res) => {
  try {
    const apiKey = req.headers['x-bolna-api-key'] || process.env.BOLNA_API_KEY;
    const agents = await bolna.listAgents(apiKey);
    res.json({ success: true, data: agents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List available agent templates
router.get('/templates/list', (req, res) => {
  res.json({ success: true, data: listTemplates() });
});

// Preview a template (substituted welcome message + prompt, no Bolna call)
router.post('/templates/preview', (req, res) => {
  try {
    const { template, vars } = req.body;
    if (!template) return res.status(400).json({ success: false, error: 'template is required' });
    const config = buildAgentConfig(template, vars || {});
    res.json({
      success: true,
      data: {
        welcome_message: config.agent_config.agent_welcome_message,
        prompt: config.agent_prompts.task_1.system_prompt,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get single agent
router.get('/:agentId', async (req, res) => {
  try {
    const apiKey = req.headers['x-bolna-api-key'] || process.env.BOLNA_API_KEY;
    const agent = await bolna.getAgent(req.params.agentId, apiKey);
    res.json({ success: true, data: agent });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a new agent (from template or custom)
router.post('/', async (req, res) => {
  try {
    const apiKey = req.headers['x-bolna-api-key'] || process.env.BOLNA_API_KEY;
    const { template, vars, custom_config } = req.body;

    let agentPayload;
    if (template) {
      agentPayload = buildAgentConfig(template, vars || {});
    } else if (custom_config) {
      agentPayload = custom_config;
    } else {
      return res.status(400).json({ success: false, error: 'Provide either template+vars or custom_config' });
    }

    const result = await bolna.createAgent(agentPayload, apiKey);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update agent welcome message and/or prompt
router.patch('/:agentId', async (req, res) => {
  try {
    const apiKey = req.headers['x-bolna-api-key'] || process.env.BOLNA_API_KEY;
    const { welcome_message, prompt, agent_name } = req.body;

    const patch = {};
    if (agent_name) patch.agent_name = agent_name;
    if (welcome_message) patch.agent_welcome_message = welcome_message;
    if (prompt) patch.agent_prompts = { task_1: { system_prompt: prompt } };

    const result = await bolna.patchAgent(req.params.agentId, patch, apiKey);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

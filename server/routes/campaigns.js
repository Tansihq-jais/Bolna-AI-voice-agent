const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const bolna = require('../bolna');
const OCRService = require('../services/ocrService');

// Configure multer for file uploads with disk storage for OCR processing
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, PDF, and image files are supported'));
    }
  }
});

// List all campaigns
router.get('/', async (req, res) => {
  try {
    const campaigns = await db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM contacts WHERE campaign_id = c.id) as total_contacts,
        (SELECT COUNT(*) FROM contacts WHERE campaign_id = c.id AND status = 'completed') as completed_calls,
        (SELECT COUNT(*) FROM contacts WHERE campaign_id = c.id AND status = 'failed') as failed_calls,
        (SELECT COALESCE(SUM(call_cost), 0) FROM contacts WHERE campaign_id = c.id) as total_cost,
        (SELECT COALESCE(SUM(call_duration), 0) FROM contacts WHERE campaign_id = c.id) as total_duration
      FROM campaigns c ORDER BY c.created_at DESC
    `).all();
    res.json({ success: true, data: campaigns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single campaign
router.get('/:id', async (req, res) => {
  try {
    const campaign = await db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
    
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'no-answer' THEN 1 ELSE 0 END) as no_answer,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as in_progress,
        COALESCE(SUM(call_cost), 0) as total_cost,
        COALESCE(SUM(call_duration), 0) as total_duration,
        COALESCE(AVG(CASE WHEN call_duration > 0 THEN call_duration END), 0) as avg_duration
      FROM contacts WHERE campaign_id = ?
    `).get(req.params.id);
    
    res.json({ success: true, data: { ...campaign, stats } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Parse uploaded file (CSV, PDF, or Images) - preview contacts with OCR support
router.post('/parse-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filePath = req.file.path;
    let contacts = [];
    let processingMethod = '';

    try {
      if (ext === '.csv') {
        processingMethod = 'CSV parsing';
        const csvContent = fs.readFileSync(filePath, 'utf8');
        const records = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
        contacts = records.map(r => ({
          contact_number: r.contact_number || r.phone || r.phone_number || r.number || '',
          name: r.name || r.first_name || r.full_name || '',
          ...r,
        }));
        
      } else if (ext === '.pdf') {
        // First try regular PDF text extraction
        processingMethod = 'PDF text extraction';
        try {
          const dataBuffer = fs.readFileSync(filePath);
          const data = await pdfParse(dataBuffer);
          const text = data.text;
          
          // Check if PDF has sufficient text content
          const isImageBased = await OCRService.isImageBasedPDF(filePath);
          
          if (isImageBased) {
            console.log('📄 PDF appears to be image-based, using OCR...');
            processingMethod = 'PDF OCR (image-based document)';
            const ocrText = await OCRService.extractTextFromPDF(filePath);
            contacts = OCRService.extractContactsFromText(ocrText);
          } else {
            console.log('📄 PDF has text content, using standard extraction...');
            // Extract phone numbers from PDF text
            const phoneRegex = /(\+?[\d\s\-().]{10,15})/g;
            const namePhoneRegex = /([A-Za-z\s]+)[,:\s]+(\+?[\d\s\-().]{10,15})/g;
            
            let match;
            const seen = new Set();
            while ((match = namePhoneRegex.exec(text)) !== null) {
              const name = match[1].trim();
              const phone = match[2].replace(/[\s\-().]/g, '');
              if (phone.length >= 10 && !seen.has(phone)) {
                seen.add(phone);
                contacts.push({ 
                  name, 
                  contact_number: phone.startsWith('+') ? phone : `+${phone}`,
                  source: 'PDF_TEXT'
                });
              }
            }
            // Fallback: just extract numbers
            if (contacts.length === 0) {
              while ((match = phoneRegex.exec(text)) !== null) {
                const phone = match[1].replace(/[\s\-().]/g, '');
                if (phone.length >= 10 && !seen.has(phone)) {
                  seen.add(phone);
                  contacts.push({ 
                    contact_number: phone.startsWith('+') ? phone : `+${phone}`, 
                    name: '',
                    source: 'PDF_TEXT'
                  });
                }
              }
            }
          }
        } catch (pdfError) {
          console.log('📄 Standard PDF extraction failed, trying OCR...', pdfError.message);
          processingMethod = 'PDF OCR (fallback)';
          const ocrText = await OCRService.extractTextFromPDF(filePath);
          contacts = OCRService.extractContactsFromText(ocrText);
        }
        
      } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'].includes(ext)) {
        processingMethod = 'Image OCR';
        console.log('🖼️ Processing image with OCR...');
        const ocrText = await OCRService.extractTextFromImage(filePath);
        
        // Check if it looks like a business card
        const businessCardInfo = OCRService.extractBusinessCardInfo(ocrText);
        if (businessCardInfo.phone && businessCardInfo.name) {
          contacts.push({
            contact_number: businessCardInfo.phone,
            name: businessCardInfo.name,
            email: businessCardInfo.email,
            company: businessCardInfo.company,
            title: businessCardInfo.title,
            source: 'BUSINESS_CARD_OCR'
          });
        } else {
          // Extract contacts normally
          contacts = OCRService.extractContactsFromText(ocrText);
        }
        
      } else {
        return res.status(400).json({ 
          success: false, 
          error: 'Unsupported file type. Supported: CSV, PDF, JPG, PNG, GIF, BMP, TIFF' 
        });
      }

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      const valid = contacts.filter(c => c.contact_number && c.contact_number.length >= 10);
      
      res.json({ 
        success: true, 
        data: { 
          contacts: valid.slice(0, 10), // Show first 10 for preview
          total: valid.length, 
          columns: Object.keys(valid[0] || {}),
          processing_method: processingMethod,
          file_type: ext.substring(1).toUpperCase()
        } 
      });
      
    } catch (processingError) {
      // Clean up file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw processingError;
    }
    
  } catch (err) {
    console.error('File parsing error:', err);
    res.status(500).json({ 
      success: false, 
      error: `Failed to process file: ${err.message}` 
    });
  }
});

// Create campaign and upload contacts with OCR support
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { name, description, agent_id, agent_name, from_phone_number, scheduled_at, retry_enabled, retry_max, retry_intervals } = req.body;
    
    if (!name || !agent_id) {
      return res.status(400).json({ success: false, error: 'name and agent_id are required' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Contact file is required' });
    }

    const campaignId = uuidv4();
    const apiKey = req.headers['x-bolna-api-key'] || process.env.BOLNA_API_KEY;
    const filePath = req.file.path;
    
    // Parse contacts with OCR support
    const ext = path.extname(req.file.originalname).toLowerCase();
    let contacts = [];
    let processingMethod = '';

    try {
      if (ext === '.csv') {
        processingMethod = 'CSV';
        const csvContent = fs.readFileSync(filePath, 'utf8');
        const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
        contacts = records.map(r => ({
          contact_number: r.contact_number || r.phone || r.phone_number || r.number || '',
          name: r.name || r.first_name || r.full_name || '',
          extra: r,
        }));
        
      } else if (ext === '.pdf') {
        // Try regular PDF extraction first
        try {
          const dataBuffer = fs.readFileSync(filePath);
          const data = await pdfParse(dataBuffer);
          const isImageBased = await OCRService.isImageBasedPDF(filePath);
          
          if (isImageBased) {
            processingMethod = 'PDF OCR';
            console.log('📄 Using OCR for image-based PDF...');
            const ocrText = await OCRService.extractTextFromPDF(filePath);
            const ocrContacts = OCRService.extractContactsFromText(ocrText);
            contacts = ocrContacts.map(c => ({
              contact_number: c.contact_number,
              name: c.name,
              extra: { source: 'OCR', ...c }
            }));
          } else {
            processingMethod = 'PDF Text';
            const text = data.text;
            const namePhoneRegex = /([A-Za-z\s]+)[,:\s]+(\+?[\d\s\-().]{10,15})/g;
            const phoneRegex = /(\+?[\d\s\-().]{10,15})/g;
            let match;
            const seen = new Set();
            while ((match = namePhoneRegex.exec(text)) !== null) {
              const name = match[1].trim();
              const phone = match[2].replace(/[\s\-().]/g, '');
              if (phone.length >= 10 && !seen.has(phone)) {
                seen.add(phone);
                contacts.push({ name, contact_number: phone.startsWith('+') ? phone : `+${phone}`, extra: {} });
              }
            }
            if (contacts.length === 0) {
              while ((match = phoneRegex.exec(text)) !== null) {
                const phone = match[1].replace(/[\s\-().]/g, '');
                if (phone.length >= 10 && !seen.has(phone)) {
                  seen.add(phone);
                  contacts.push({ contact_number: phone.startsWith('+') ? phone : `+${phone}`, name: '', extra: {} });
                }
              }
            }
          }
        } catch (pdfError) {
          processingMethod = 'PDF OCR (fallback)';
          console.log('📄 PDF text extraction failed, using OCR...', pdfError.message);
          const ocrText = await OCRService.extractTextFromPDF(filePath);
          const ocrContacts = OCRService.extractContactsFromText(ocrText);
          contacts = ocrContacts.map(c => ({
            contact_number: c.contact_number,
            name: c.name,
            extra: { source: 'OCR_FALLBACK', ...c }
          }));
        }
        
      } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'].includes(ext)) {
        processingMethod = 'Image OCR';
        console.log('🖼️ Processing image with OCR...');
        const ocrText = await OCRService.extractTextFromImage(filePath);
        const ocrContacts = OCRService.extractContactsFromText(ocrText);
        contacts = ocrContacts.map(c => ({
          contact_number: c.contact_number,
          name: c.name,
          extra: { source: 'IMAGE_OCR', ...c }
        }));
      }

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      const validContacts = contacts.filter(c => c.contact_number && c.contact_number.length >= 10);
      if (validContacts.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: `No valid phone numbers found in ${ext.substring(1).toUpperCase()} file using ${processingMethod}` 
        });
      }

      // Build retry config
      let retryConfig = null;
      if (retry_enabled === 'true') {
        retryConfig = {
          enabled: true,
          max_retries: parseInt(retry_max) || 2,
          retry_on_statuses: ['no-answer', 'busy', 'failed'],
          retry_intervals_minutes: retry_intervals ? JSON.parse(retry_intervals) : [30, 60],
        };
      }

      // Build webhook URL
      const webhookUrl = `${process.env.WEBHOOK_BASE_URL || 'http://localhost:3001'}/api/webhook/bolna/${campaignId}`;

      // Build CSV buffer for Bolna batch API
      const csvHeader = 'contact_number,name\n';
      const csvRows = validContacts.map(c => `${c.contact_number},${(c.name || '').replace(/,/g, ' ')}`).join('\n');
      const csvBuffer = Buffer.from(csvHeader + csvRows);

      // Create batch on Bolna
      let batchId = null;
      try {
        const fromPhones = from_phone_number ? [from_phone_number] : [];
        const batchResult = await bolna.createBatch(agent_id, csvBuffer, 'contacts.csv', fromPhones, webhookUrl, retryConfig, apiKey);
        batchId = batchResult.batch_id;

        // Schedule if needed
        if (scheduled_at) {
          await bolna.scheduleBatch(batchId, scheduled_at, apiKey);
        } else {
          // Run now - schedule for 1 minute from now
          const runAt = new Date(Date.now() + 60000).toISOString();
          await bolna.scheduleBatch(batchId, runAt, apiKey);
        }
      } catch (bolnaErr) {
        console.error('Bolna batch error:', bolnaErr.message);
        // Continue - save campaign locally even if Bolna fails
      }

      // Save campaign to DB
      await db.prepare(`
        INSERT INTO campaigns (id, name, description, agent_id, agent_name, status, from_phone_number, scheduled_at, webhook_url, batch_id, retry_config)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        campaignId, name, description || '', agent_id, agent_name || '',
        scheduled_at ? 'scheduled' : 'running',
        from_phone_number || '', scheduled_at || null, webhookUrl, batchId,
        retryConfig ? JSON.stringify(retryConfig) : null
      );

      // Save contacts to DB
      const insertContact = db.prepare(`
        INSERT INTO contacts (id, campaign_id, contact_number, name, extra_data, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `);
      
      // Insert contacts one by one
      for (const c of validContacts) {
        await insertContact.run(uuidv4(), campaignId, c.contact_number, c.name || '', JSON.stringify(c.extra || {}));
      }

      res.json({
        success: true,
        data: {
          campaign_id: campaignId,
          batch_id: batchId,
          total_contacts: validContacts.length,
          status: scheduled_at ? 'scheduled' : 'running',
          processing_method: processingMethod,
          message: `Campaign created with ${validContacts.length} contacts extracted using ${processingMethod}`,
        },
      });
      
    } catch (processingError) {
      // Clean up file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw processingError;
    }
    
  } catch (err) {
    console.error('Campaign creation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stop campaign
router.post('/:id/stop', async (req, res) => {
  try {
    const campaign = await db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
    
    const apiKey = req.headers['x-bolna-api-key'] || process.env.BOLNA_API_KEY;
    if (campaign.batch_id) {
      try { await bolna.stopBatch(campaign.batch_id, apiKey); } catch (e) { console.error('Stop batch error:', e.message); }
    }
    
    await db.prepare("UPDATE campaigns SET status = 'stopped', updated_at = NOW() WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: 'Campaign stopped' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Sync campaign status from Bolna
router.post('/:id/sync', async (req, res) => {
  try {
    const campaign = await db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign || !campaign.batch_id) return res.status(404).json({ success: false, error: 'Campaign or batch not found' });
    
    const apiKey = req.headers['x-bolna-api-key'] || process.env.BOLNA_API_KEY;
    const [batchStatus, executions] = await Promise.all([
      bolna.getBatch(campaign.batch_id, apiKey),
      bolna.getBatchExecutions(campaign.batch_id, apiKey),
    ]);

    const PLATFORM_MARKUP_RATE = parseFloat(process.env.PLATFORM_MARKUP_PER_MIN) || 0.02;

    if (Array.isArray(executions)) {
      for (const exec of executions) {
        const duration = exec.conversation_time || 0;
        const bolnaCost = exec.total_cost || 0;
        const platformCost = (duration / 60) * PLATFORM_MARKUP_RATE;
        const totalExecCost = bolnaCost + platformCost;

        await db.prepare(`
          UPDATE contacts SET status = ?, execution_id = ?, call_duration = ?, call_cost = ?, 
          transcript = ?, extracted_data = ?, hangup_reason = ?, completed_at = datetime('now')
          WHERE campaign_id = ? AND contact_number = ?
        `).run(
          exec.status || 'completed', exec.id, duration, totalExecCost,
          exec.transcript || '',
          exec.extracted_data ? JSON.stringify(exec.extracted_data) : null,
          exec.telephony_data?.hangup_reason || '',
          campaign.id, exec.telephony_data?.to_number || ''
        );
      }
    }

    const newStatus = batchStatus.status === 'completed' ? 'completed' : 
                      batchStatus.status === 'stopped' ? 'stopped' : 'running';
    await db.prepare(`UPDATE campaigns SET status = $1, updated_at = NOW() WHERE id = $2`).run(newStatus, campaign.id);

    res.json({ success: true, data: { batch_status: batchStatus.status, executions_synced: Array.isArray(executions) ? executions.length : 0 } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

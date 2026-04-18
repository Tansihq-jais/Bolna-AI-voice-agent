const express = require('express');
const router = express.Router();
const CallInsight = require('../models/CallInsight');
const InsightsAnalyzer = require('../services/insightsAnalyzer');
const MongoDB = require('../config/mongodb');

// Get insights dashboard
router.get('/dashboard', async (req, res) => {
  try {
    if (!MongoDB.isConnected()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Insights service unavailable - MongoDB not connected' 
      });
    }

    const { campaignId } = req.query;
    const insights = await InsightsAnalyzer.getDashboardInsights(campaignId);
    
    res.json({ success: true, data: insights });
  } catch (error) {
    console.error('Error fetching insights dashboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get leads by category
router.get('/leads/:category', async (req, res) => {
  try {
    if (!MongoDB.isConnected()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Insights service unavailable - MongoDB not connected' 
      });
    }

    const { category } = req.params;
    const { campaignId, page = 1, limit = 50 } = req.query;
    
    const query = { leadCategory: category };
    if (campaignId) query.campaignId = campaignId;
    
    const skip = (page - 1) * limit;
    
    const leads = await CallInsight.find(query)
      .sort({ leadScore: -1, calledAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('contactNumber contactName leadScore leadCategory buyingIntent sentiment callDuration calledAt followUpRequired nextAction');
    
    const total = await CallInsight.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        leads,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching leads by category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get detailed insight for a specific call
router.get('/call/:executionId', async (req, res) => {
  try {
    if (!MongoDB.isConnected()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Insights service unavailable - MongoDB not connected' 
      });
    }

    const { executionId } = req.params;
    const insight = await CallInsight.findOne({ executionId });
    
    if (!insight) {
      return res.status(404).json({ success: false, error: 'Call insight not found' });
    }
    
    res.json({ success: true, data: insight });
  } catch (error) {
    console.error('Error fetching call insight:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get campaign insights summary
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    if (!MongoDB.isConnected()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Insights service unavailable - MongoDB not connected' 
      });
    }

    const { campaignId } = req.params;
    const insights = await CallInsight.getCampaignInsights(campaignId);
    
    // Get lead distribution
    const leadDistribution = await CallInsight.aggregate([
      { $match: { campaignId } },
      { $group: { _id: '$leadCategory', count: { $sum: 1 } } }
    ]);
    
    // Get buying intent distribution
    const buyingIntentDistribution = await CallInsight.aggregate([
      { $match: { campaignId } },
      { $group: { _id: '$buyingIntent.level', count: { $sum: 1 } } }
    ]);
    
    // Get top objections
    const topObjections = await CallInsight.aggregate([
      { $match: { campaignId } },
      { $unwind: '$objections' },
      { $group: { _id: '$objections.type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    res.json({
      success: true,
      data: {
        summary: insights,
        leadDistribution,
        buyingIntentDistribution,
        topObjections
      }
    });
  } catch (error) {
    console.error('Error fetching campaign insights:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update lead category manually
router.put('/lead/:executionId/category', async (req, res) => {
  try {
    if (!MongoDB.isConnected()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Insights service unavailable - MongoDB not connected' 
      });
    }

    const { executionId } = req.params;
    const { category, notes } = req.body;
    
    const validCategories = ['hot', 'warm', 'cold', 'not-interested', 'callback', 'dnc'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid category. Must be one of: ' + validCategories.join(', ') 
      });
    }
    
    const insight = await CallInsight.findOneAndUpdate(
      { executionId },
      { 
        leadCategory: category,
        ...(notes && { notes })
      },
      { new: true }
    );
    
    if (!insight) {
      return res.status(404).json({ success: false, error: 'Call insight not found' });
    }
    
    res.json({ success: true, data: insight });
  } catch (error) {
    console.error('Error updating lead category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set follow-up date
router.put('/lead/:executionId/followup', async (req, res) => {
  try {
    if (!MongoDB.isConnected()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Insights service unavailable - MongoDB not connected' 
      });
    }

    const { executionId } = req.params;
    const { followUpDate, nextAction, notes } = req.body;
    
    const insight = await CallInsight.findOneAndUpdate(
      { executionId },
      { 
        followUpDate: new Date(followUpDate),
        followUpRequired: true,
        ...(nextAction && { nextAction }),
        ...(notes && { notes })
      },
      { new: true }
    );
    
    if (!insight) {
      return res.status(404).json({ success: false, error: 'Call insight not found' });
    }
    
    res.json({ success: true, data: insight });
  } catch (error) {
    console.error('Error setting follow-up:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get follow-ups due
router.get('/followups/due', async (req, res) => {
  try {
    if (!MongoDB.isConnected()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Insights service unavailable - MongoDB not connected' 
      });
    }

    const { campaignId } = req.query;
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    const query = {
      followUpRequired: true,
      followUpDate: { $lte: today }
    };
    
    if (campaignId) query.campaignId = campaignId;
    
    const followUps = await CallInsight.find(query)
      .sort({ followUpDate: 1 })
      .select('contactNumber contactName leadCategory followUpDate nextAction campaignName notes');
    
    res.json({ success: true, data: followUps });
  } catch (error) {
    console.error('Error fetching due follow-ups:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export leads by category
router.get('/export/:category', async (req, res) => {
  try {
    if (!MongoDB.isConnected()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Insights service unavailable - MongoDB not connected' 
      });
    }

    const { category } = req.params;
    const { campaignId } = req.query;
    
    const query = { leadCategory: category };
    if (campaignId) query.campaignId = campaignId;
    
    const leads = await CallInsight.find(query)
      .sort({ leadScore: -1 })
      .select('contactNumber contactName leadScore leadCategory buyingIntent sentiment callDuration extractedData calledAt nextAction notes');
    
    // Convert to CSV format
    const csvHeaders = [
      'Contact Number', 'Name', 'Lead Score', 'Category', 'Buying Intent', 
      'Sentiment', 'Call Duration', 'Company', 'Industry', 'Called At', 
      'Next Action', 'Notes'
    ];
    
    const csvRows = leads.map(lead => [
      lead.contactNumber,
      lead.contactName || '',
      lead.leadScore,
      lead.leadCategory,
      lead.buyingIntent?.level || '',
      lead.sentiment?.overall || '',
      lead.callDuration,
      lead.extractedData?.companyName || '',
      lead.extractedData?.industry || '',
      lead.calledAt?.toISOString() || '',
      lead.nextAction || '',
      lead.notes || ''
    ]);
    
    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${category}-leads.csv"`);
    res.send(csvContent);
    
  } catch (error) {
    console.error('Error exporting leads:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
const mongoose = require('mongoose');

/**
 * CallInsight — stored in MongoDB Atlas (shared CRM database)
 * Raw transcripts are NEVER stored here — only extracted insights.
 * This collection is readable by CRM agents and other services.
 */
const CallInsightSchema = new mongoose.Schema({

  // --- Identifiers (link back to PostgreSQL if needed) ---
  campaignId:    { type: String, required: true, index: true },
  campaignName:  String,
  contactId:     { type: String, required: true },
  executionId:   { type: String, required: true, unique: true },
  contactNumber: { type: String, required: true },
  contactName:   String,
  agentId:       String,
  agentName:     String,

  // --- Call basics ---
  callDuration:  { type: Number, default: 0 },   // seconds
  callStatus:    { type: String, enum: ['completed', 'failed', 'no-answer', 'busy', 'error'] },
  hangupReason:  String,
  callCost:      { type: Number, default: 0 },
  calledAt:      { type: Date, default: Date.now },

  // --- Lead classification (used by CRM) ---
  leadScore:    { type: Number, min: 0, max: 100, default: 0, index: true },
  leadCategory: {
    type: String,
    enum: ['hot', 'warm', 'cold', 'not-interested', 'callback', 'dnc'],
    default: 'cold',
    index: true
  },

  // --- Conversation summary (replaces raw transcript) ---
  conversationSummary: String,   // 1-3 sentence AI summary
  keyTopics:           [String], // e.g. ["pricing", "demo", "timeline"]

  // --- Sentiment ---
  sentiment: {
    overall: { type: String, enum: ['positive', 'neutral', 'negative'] },
    score:   { type: Number, min: -1, max: 1 }
  },

  // --- Buying intent ---
  buyingIntent: {
    level:      { type: String, enum: ['high', 'medium', 'low', 'none'], default: 'none', index: true },
    indicators: [String],  // phrases that triggered this classification
    timeline:   String     // "immediate", "within 30 days", "3-6 months", "future"
  },

  // --- Interest & engagement ---
  interestLevel:    { type: Number, min: 0, max: 10, default: 0 },
  engagementScore:  { type: Number, min: 0, max: 10, default: 0 },

  // --- Extracted business info (from conversation) ---
  extractedData: {
    companyName:     String,
    industry:        String,
    budget:          String,
    decisionMaker:   Boolean,
    painPoints:      [String],
    requirements:    [String],
    currentSolution: String,
  },

  // --- Objections raised ---
  objections: [{
    type:     String,   // "price", "timing", "authority", "need"
    resolved: Boolean
  }],

  // --- Follow-up ---
  followUpRequired: { type: Boolean, default: false, index: true },
  followUpDate:     Date,
  nextAction:       String,
  notes:            String,

}, {
  timestamps: true,
  collection: 'call_insights'
});

// Compound indexes for CRM queries
CallInsightSchema.index({ campaignId: 1, leadCategory: 1 });
CallInsightSchema.index({ leadScore: -1, calledAt: -1 });
CallInsightSchema.index({ contactNumber: 1 });
CallInsightSchema.index({ followUpRequired: 1, followUpDate: 1 });
CallInsightSchema.index({ 'buyingIntent.level': 1, leadScore: -1 });

// Auto-assign category from score
CallInsightSchema.methods.calculateLeadScore = function () {
  let score = 0;

  if (this.callStatus === 'completed') score += 20;

  // Duration
  if (this.callDuration > 300)      score += 15;
  else if (this.callDuration > 120) score += 10;
  else if (this.callDuration > 60)  score += 5;

  // Sentiment
  if (this.sentiment?.overall === 'positive') score += 20;
  else if (this.sentiment?.overall === 'neutral') score += 8;

  // Buying intent
  const intentMap = { high: 25, medium: 15, low: 5, none: 0 };
  score += intentMap[this.buyingIntent?.level] || 0;

  // Interest level (0-10 → 0-20 pts)
  score += (this.interestLevel || 0) * 2;

  // Decision maker
  if (this.extractedData?.decisionMaker) score += 10;

  // Budget mentioned
  if (this.extractedData?.budget) score += 5;

  // Follow-up requested
  if (this.followUpRequired) score += 10;

  // Engagement
  score += Math.min(this.engagementScore || 0, 10);

  this.leadScore = Math.min(score, 100);

  if (this.leadScore >= 80)      this.leadCategory = 'hot';
  else if (this.leadScore >= 60) this.leadCategory = 'warm';
  else if (this.leadScore >= 30) this.leadCategory = 'cold';
  else                           this.leadCategory = 'not-interested';

  return this.leadScore;
};

// Static: summary for a campaign
CallInsightSchema.statics.getCampaignSummary = async function (campaignId) {
  const [summary] = await this.aggregate([
    { $match: { campaignId } },
    {
      $group: {
        _id: null,
        totalCalls:       { $sum: 1 },
        avgScore:         { $avg: '$leadScore' },
        hotLeads:         { $sum: { $cond: [{ $eq: ['$leadCategory', 'hot'] },  1, 0] } },
        warmLeads:        { $sum: { $cond: [{ $eq: ['$leadCategory', 'warm'] }, 1, 0] } },
        coldLeads:        { $sum: { $cond: [{ $eq: ['$leadCategory', 'cold'] }, 1, 0] } },
        followUps:        { $sum: { $cond: ['$followUpRequired', 1, 0] } },
        highIntent:       { $sum: { $cond: [{ $eq: ['$buyingIntent.level', 'high'] },   1, 0] } },
        mediumIntent:     { $sum: { $cond: [{ $eq: ['$buyingIntent.level', 'medium'] }, 1, 0] } },
        avgDuration:      { $avg: '$callDuration' },
        totalCost:        { $sum: '$callCost' },
      }
    }
  ]);
  return summary || {};
};

module.exports = mongoose.model('CallInsight', CallInsightSchema);

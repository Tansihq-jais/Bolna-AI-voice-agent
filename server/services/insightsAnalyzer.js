/**
 * insightsAnalyzer.js
 * 
 * Analyzes call transcripts using a 3-tier fallback strategy:
 *   1. Sarvam AI  — primary (purpose-built for Indian languages, free LLM)
 *   2. Groq       — fallback (Llama 3.3 70B, excellent Hinglish support)
 *   3. Keyword    — last resort (no API, basic accuracy)
 * 
 * Transcripts are NEVER stored. Only structured insights go to MongoDB.
 */

const CallInsight = require('../models/CallInsight');
const MongoDB     = require('../config/mongodb');
const Groq        = require('groq-sdk');
const fetch       = require('node-fetch');

// ─── Clients (lazy-init so missing keys don't crash on startup) ──────────────
let groqClient = null;
function getGroqClient() {
  if (!groqClient && process.env.GROQ_API_KEY) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

// ─── The structured prompt sent to both Sarvam and Groq ─────────────────────
// Sarvam-m has a 7192 token context window (~5000 chars of prompt budget after system/structure)
// Strategy: use Bolna's summary if available, else smart-truncate the transcript
const MAX_TRANSCRIPT_CHARS = 2500;

function prepareTranscript(transcript) {
  if (!transcript || transcript.length <= MAX_TRANSCRIPT_CHARS) return transcript;
  // Take first 1000 chars (opening) + last 1500 chars (closing/outcome) — most signal is here
  const head = transcript.slice(0, 1000);
  const tail = transcript.slice(-1500);
  return `${head}\n...[middle truncated]...\n${tail}`;
}

function buildPrompt(transcript, callDuration) {
  return `You are an expert sales call analyst. Analyze the following call transcript and return a JSON object with insights.

The transcript may be in Hindi, English, Hinglish (mixed Hindi-English), Tamil, Telugu, Marathi, Bengali, or other Indian languages. Understand it fully regardless of language.

Call duration: ${callDuration} seconds

Transcript:
"""
${prepareTranscript(transcript)}
"""

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "sentiment": {
    "overall": "positive" | "neutral" | "negative",
    "score": <number between -1 and 1>,
    "reasoning": "<one sentence why>"
  },
  "buyingIntent": {
    "level": "high" | "medium" | "low" | "none",
    "indicators": ["<phrase that showed intent>"],
    "timeline": "<immediate | within 30 days | 3-6 months | future | unknown>"
  },
  "interestLevel": <0-10>,
  "engagementScore": <0-10>,
  "keyTopics": ["<topic1>", "<topic2>"],
  "objections": [
    { "type": "<price | timing | authority | need | other>", "detail": "<what they said>", "resolved": <true|false> }
  ],
  "extractedData": {
    "companyName": "<if mentioned, else null>",
    "industry": "<if mentioned, else null>",
    "budget": "<if mentioned, else null>",
    "decisionMaker": <true | false | null>,
    "painPoints": ["<pain point>"],
    "requirements": ["<requirement>"],
    "currentSolution": "<if mentioned, else null>"
  },
  "followUpRequired": <true | false>,
  "conversationSummary": "<2-3 sentence summary in English regardless of transcript language>",
  "nextAction": "<specific recommended action>",
  "detectedLanguage": "<primary language of transcript e.g. Hindi, Hinglish, Tamil, English>"
}`;
}

// ─── Sarvam AI call ──────────────────────────────────────────────────────────
async function analyzeWithSarvam(transcript, callDuration) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) throw new Error('SARVAM_API_KEY not set');

  const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
    },
    body: JSON.stringify({
      model: 'sarvam-m',
      messages: [
        {
          role: 'system',
          content: 'You are a sales call analyst. Always respond with valid JSON only. No markdown, no explanation.',
        },
        {
          role: 'user',
          content: buildPrompt(transcript, callDuration),
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    }),
    timeout: 30000,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Sarvam API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Sarvam');

  // Strip <think>...</think> reasoning block if model returns it
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return JSON.parse(cleaned);
}

// ─── Groq fallback ───────────────────────────────────────────────────────────
async function analyzeWithGroq(transcript, callDuration) {
  const client = getGroqClient();
  if (!client) throw new Error('GROQ_API_KEY not set');

  const completion = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'You are a sales call analyst. Always respond with valid JSON only. No markdown, no explanation.',
      },
      {
        role: 'user',
        content: buildPrompt(transcript, callDuration),
      },
    ],
    temperature: 0.1,
    max_tokens: 1000,
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Groq');

  return JSON.parse(content.trim());
}

// ─── Keyword fallback (last resort, no API needed) ───────────────────────────
function analyzeWithKeywords(transcript, callDuration) {
  const t = transcript.toLowerCase();

  // Works for basic English — will miss most Hindi/regional content
  const posWords = ['interested', 'great', 'yes', 'definitely', 'sounds good', 'perfect', 'sure', 'absolutely'];
  const negWords = ['not interested', 'no', 'busy', 'remove', 'stop calling', "don't call", 'waste'];
  const posCount = posWords.filter(w => t.includes(w)).length;
  const negCount = negWords.filter(w => t.includes(w)).length;

  const sentiment = posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral';
  const sentimentScore = posCount > negCount ? 0.5 : negCount > posCount ? -0.5 : 0;

  const highIntent  = ['how much', 'price', 'cost', "let's start", 'send quote', 'next step'].some(w => t.includes(w));
  const medIntent   = ['interested', 'tell me more', 'sounds good', 'considering'].some(w => t.includes(w));
  const intentLevel = highIntent ? 'high' : medIntent ? 'medium' : 'low';

  const followUp = ['call back', 'follow up', 'send me', 'email me', 'contact me'].some(w => t.includes(w));

  const sentences = transcript.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
  const summary   = sentences.length > 0
    ? `${sentences[0]}${sentences.length > 1 ? '. ' + sentences[sentences.length - 1] : ''}.`
    : 'Call completed.';

  return {
    sentiment:    { overall: sentiment, score: sentimentScore, reasoning: 'Keyword-based analysis' },
    buyingIntent: { level: intentLevel, indicators: [], timeline: 'unknown' },
    interestLevel:   callDuration > 180 ? 6 : callDuration > 60 ? 4 : 2,
    engagementScore: callDuration > 180 ? 5 : 3,
    keyTopics:       [],
    objections:      [],
    extractedData:   { companyName: null, industry: null, budget: null, decisionMaker: null, painPoints: [], requirements: [], currentSolution: null },
    followUpRequired: followUp,
    conversationSummary: summary,
    nextAction:      followUp ? 'Follow up as requested' : 'Add to nurture campaign',
    detectedLanguage: 'Unknown (keyword fallback)',
  };
}

// ─── Apply LLM result to the insight document ────────────────────────────────
function applyAnalysis(insight, result) {
  insight.sentiment        = { overall: result.sentiment?.overall || 'neutral', score: result.sentiment?.score || 0 };
  insight.buyingIntent     = {
    level:      result.buyingIntent?.level      || 'none',
    indicators: result.buyingIntent?.indicators || [],
    timeline:   result.buyingIntent?.timeline   || '',
  };
  insight.interestLevel        = Math.min(10, Math.max(0, result.interestLevel   || 0));
  insight.engagementScore      = Math.min(10, Math.max(0, result.engagementScore || 0));
  insight.keyTopics            = result.keyTopics    || [];
  insight.objections           = (result.objections  || []).map(o => ({ type: o.type, resolved: o.resolved || false }));
  insight.followUpRequired     = result.followUpRequired || false;
  insight.conversationSummary  = result.conversationSummary || '';
  insight.nextAction           = result.nextAction   || '';

  if (result.extractedData) {
    insight.extractedData = {
      companyName:     result.extractedData.companyName     || undefined,
      industry:        result.extractedData.industry        || undefined,
      budget:          result.extractedData.budget          || undefined,
      decisionMaker:   result.extractedData.decisionMaker   ?? undefined,
      painPoints:      result.extractedData.painPoints      || [],
      requirements:    result.extractedData.requirements    || [],
      currentSolution: result.extractedData.currentSolution || undefined,
    };
  }

  // Store detected language in notes for visibility
  if (result.detectedLanguage) {
    insight.notes = `Language: ${result.detectedLanguage}`;
  }
}

// ─── Main entry point ────────────────────────────────────────────────────────
class InsightsAnalyzer {

  static async analyzeCall(callData) {
    const {
      campaignId, contactId, executionId, contactNumber, contactName,
      transcript, bolnaSummary, callDuration, callStatus, hangupReason, callCost,
      extractedData, agentId, agentName, campaignName,
    } = callData;

    // Use Bolna's pre-built summary as the analysis input when the raw transcript is too large.
    // Bolna's summary is already concise and fits well within Sarvam's context window.
    // Fall back to the raw transcript (which gets smart-truncated) if no summary exists.
    const analysisInput = (bolnaSummary && bolnaSummary.length > 20) ? bolnaSummary : transcript;

    // Upsert — safe against duplicate webhook deliveries
    // Only query MongoDB if connected
    let insight = MongoDB.isConnected()
      ? await CallInsight.findOne({ executionId })
      : null;
    if (!insight) {
      insight = new CallInsight({
        campaignId, contactId, executionId,
        contactNumber, contactName, agentId, agentName, campaignName,
      });
    }

    insight.callDuration = callDuration || 0;
    insight.callStatus   = callStatus;
    insight.hangupReason = hangupReason;
    insight.callCost     = callCost || 0;

    // Merge Bolna's own extracted data if present
    if (extractedData && typeof extractedData === 'object') {
      insight.extractedData = {
        companyName:     extractedData.company_name     || extractedData.companyName,
        industry:        extractedData.industry,
        budget:          extractedData.budget,
        decisionMaker:   extractedData.decision_maker   ?? extractedData.decisionMaker,
        painPoints:      extractedData.pain_points       || extractedData.painPoints       || [],
        requirements:    extractedData.requirements      || [],
        currentSolution: extractedData.current_solution || extractedData.currentSolution,
      };
    }

    // ── Analyze transcript with 3-tier fallback ──────────────────────────────
    if (analysisInput && analysisInput.length > 20) {
      let result   = null;
      let provider = null;

      // Tier 1: Sarvam AI
      try {
        result   = await analyzeWithSarvam(analysisInput, callDuration);
        provider = 'sarvam';
        console.log(`🇮🇳 Sarvam analysis OK for ${executionId} (lang: ${result.detectedLanguage})`);
      } catch (sarvamErr) {
        console.warn(`⚠️  Sarvam failed for ${executionId}: ${sarvamErr.message}`);

        // Tier 2: Groq
        try {
          result   = await analyzeWithGroq(analysisInput, callDuration);
          provider = 'groq';
          console.log(`🤖 Groq fallback OK for ${executionId}`);
        } catch (groqErr) {
          console.warn(`⚠️  Groq failed for ${executionId}: ${groqErr.message}`);

          // Tier 3: Keywords
          result   = analyzeWithKeywords(analysisInput, callDuration);
          provider = 'keyword';
          console.warn(`🔤 Keyword fallback used for ${executionId}`);
        }
      }

      applyAnalysis(insight, result);

      // Tag which provider was used (useful for debugging quality)
      insight.notes = `${insight.notes || ''} | Provider: ${provider}`.trim().replace(/^\|/, '').trim();
    }

    insight.calculateLeadScore();

    // Only save to MongoDB if connected — avoids buffering timeout when Atlas is unreachable
    if (MongoDB.isConnected()) {
      await insight.save();
    } else {
      console.warn(`⚠️  MongoDB not connected — insight for ${executionId} analyzed but not persisted`);
    }

    // Transcript goes out of scope here — never persisted
    return insight;
  }

  // ── Dashboard summary (unchanged API) ──────────────────────────────────────
  static async getDashboardInsights(campaignId = null) {
    const match = campaignId ? { campaignId } : {};

    const [summary] = await CallInsight.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalCalls:    { $sum: 1 },
          averageScore:  { $avg: '$leadScore' },
          hotLeads:      { $sum: { $cond: [{ $eq: ['$leadCategory', 'hot'] },  1, 0] } },
          warmLeads:     { $sum: { $cond: [{ $eq: ['$leadCategory', 'warm'] }, 1, 0] } },
          coldLeads:     { $sum: { $cond: [{ $eq: ['$leadCategory', 'cold'] }, 1, 0] } },
          notInterested: { $sum: { $cond: [{ $eq: ['$leadCategory', 'not-interested'] }, 1, 0] } },
          followUps:     { $sum: { $cond: ['$followUpRequired', 1, 0] } },
          highIntent:    { $sum: { $cond: [{ $eq: ['$buyingIntent.level', 'high'] },   1, 0] } },
          mediumIntent:  { $sum: { $cond: [{ $eq: ['$buyingIntent.level', 'medium'] }, 1, 0] } },
          totalRevenue:  { $sum: '$callCost' },
          avgDuration:   { $avg: '$callDuration' },
        },
      },
    ]);

    const topTopics = await CallInsight.aggregate([
      { $match: match },
      { $unwind: '$keyTopics' },
      { $group: { _id: '$keyTopics', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    return {
      summary:   summary || {},
      topTopics: topTopics.map(t => ({ topic: t._id, count: t.count })),
    };
  }
}

module.exports = InsightsAnalyzer;

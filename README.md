# Voice Campaign Platform

A production-ready voice AI calling platform powered by Bolna AI. Built for businesses who want to run automated voice campaigns.

## 🚀 Features

- 📞 **Automated Voice Campaigns**: Launch voice calling campaigns using Bolna AI agents
- 🔍 **Advanced OCR Processing**: Extract contacts from PDFs, images, and business cards
- 📊 **Real-time Analytics**: Track call performance and campaign metrics
- 🧠 **AI-Powered Lead Scoring**: Automatic lead classification and scoring (0-100)
- 💰 **Billing Management**: Automatic cost tracking and billing
- 🏢 **Multi-tenant**: Sub-account management for multiple clients
- 📱 **Responsive Dashboard**: Modern web interface for campaign management

## 📁 File Upload Support

### Supported File Types
- **CSV**: Direct contact list import
- **PDF**: Text-based or scanned documents (with OCR)
- **Images**: JPG, PNG, GIF, BMP, TIFF (business cards, contact lists)

### OCR Capabilities
- **Automatic Detection**: Determines if PDF is text-based or requires OCR
- **Business Card Processing**: Extracts names, phones, emails, companies
- **Contact List Recognition**: Processes scanned directories and lists
- **Multi-format Support**: Handles various phone number formats globally

## 📋 Prerequisites

- Node.js 18+
- Bolna AI account and API key
- Public URL for webhooks

## ⚡ Quick Start

### 1. Installation

```bash
cd voice-campaign-platform
npm run install:all
```

### 2. Configuration

Copy `.env.example` to `.env` and configure:

```env
# Bolna AI Configuration
BOLNA_API_KEY=your_bolna_api_key_here
BOLNA_API_BASE=https://api.bolna.ai

# Pricing Configuration
PLATFORM_MARKUP_PER_MIN=0.02
BOLNA_BASE_COST_PER_MIN=0.02

# Webhook URL (your server's public URL)
WEBHOOK_BASE_URL=https://your-domain.com

# Server Configuration
PORT=3001
NODE_ENV=production
```

### 3. Build and Start

```bash
# Build frontend
npm run build

# Start production server
npm start
```

## 🧠 AI-Powered Call Insights & Lead Scoring

The platform includes advanced AI-powered analysis that automatically extracts insights from every call and scores leads based on their likelihood to convert.

### Features

- **Automatic Lead Scoring**: AI analyzes call transcripts to score leads 0-100
- **Lead Classification**: Automatically categorizes leads as Hot, Warm, Cold, or Not Interested
- **Sentiment Analysis**: Detects positive, neutral, or negative sentiment from conversations
- **Buying Intent Detection**: Identifies high, medium, low, or no buying intent
- **Topic Extraction**: Automatically identifies key conversation topics
- **Follow-up Management**: Tracks which leads require follow-up and when
- **Objection Tracking**: Identifies and categorizes common objections
- **Conversation Metrics**: Analyzes talk time, engagement, and conversation quality

### Database Options

The insights system supports multiple database configurations:

**MongoDB (Recommended for Production)**
```env
MONGODB_URI=mongodb://localhost:27017/voice-campaign-insights
```

**MongoDB Atlas (Cloud)**
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/voice-campaign-insights
```

**Alternative Databases**
- PostgreSQL with Mongoose ODM
- MySQL with appropriate adapters
- Any MongoDB-compatible database

### Lead Scoring Algorithm

The AI scoring system considers multiple factors:

- **Call Completion**: +20 points for completed calls
- **Call Duration**: Up to +15 points for longer conversations
- **Sentiment**: +20 for positive, +10 for neutral sentiment
- **Buying Intent**: +25 for high, +15 for medium intent
- **Interest Level**: +2 points per interest level (0-10 scale)
- **Decision Maker**: +10 points if contact is decision maker
- **Budget Mentioned**: +10 points if budget discussed
- **Follow-up Requested**: +15 points if follow-up requested
- **Engagement Score**: Up to +10 points for conversation engagement

### Lead Categories

- **Hot Leads (80-100 points)**: High buying intent, positive sentiment, ready to move forward
- **Warm Leads (60-79 points)**: Interested but need nurturing, may have timeline concerns
- **Cold Leads (30-59 points)**: Some interest but significant barriers or long timeline
- **Not Interested (0-29 points)**: Little to no interest, negative sentiment

### API Endpoints

```javascript
// Get insights dashboard
GET /api/insights/dashboard

// Get leads by category
GET /api/insights/leads/hot
GET /api/insights/leads/warm
GET /api/insights/leads/cold

// Get campaign insights
GET /api/insights/campaign/:campaignId

// Update lead category
PUT /api/insights/lead/:executionId/category

// Export leads
GET /api/insights/export/hot
```

## 🏗️ Architecture

```
React Frontend → Express API → Bolna AI API
                     ↓
               SQLite Database
                     ↑
            Bolna Webhooks
```

## 📊 API Integration

The platform provides REST API endpoints for integration:

- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/analytics/overview` - Get analytics
- `POST /api/webhook/bolna/:campaignId` - Webhook endpoint

## 🚀 Production Deployment

### Docker Deployment

```bash
# Build and run with Docker
docker build -t voice-campaign-platform .
docker run -p 3001:3001 --env-file .env voice-campaign-platform
```

### Docker Compose

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🔒 Security

- API key protection
- Input validation
- Rate limiting
- HTTPS required for production
- Secure webhook handling

## 📄 License

MIT License - see LICENSE file for details.

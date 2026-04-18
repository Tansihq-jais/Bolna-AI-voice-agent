/**
 * analysisQueue.js
 * Simple in-memory async queue for transcript analysis jobs.
 * Webhook responds immediately — analysis happens in the background.
 * 
 * Flow: enqueue(job) → worker picks it up → calls insightsAnalyzer → saves to MongoDB
 * On failure: retries up to MAX_RETRIES with exponential backoff
 */

const InsightsAnalyzer = require('./insightsAnalyzer');

const MAX_RETRIES    = 3;
const RETRY_DELAY_MS = 2000; // doubles each retry

class AnalysisQueue {
  constructor() {
    this.queue    = [];
    this.running  = false;
    this.stats    = { processed: 0, failed: 0, retried: 0 };
  }

  // Add a job to the queue
  enqueue(jobData) {
    this.queue.push({ ...jobData, retries: 0, enqueuedAt: Date.now() });
    console.log(`📥 Queued analysis for ${jobData.executionId} (queue size: ${this.queue.length})`);
    if (!this.running) this._processNext();
  }

  async _processNext() {
    if (this.queue.length === 0) {
      this.running = false;
      return;
    }

    this.running = true;
    const job = this.queue.shift();

    try {
      await InsightsAnalyzer.analyzeCall(job);
      this.stats.processed++;
      console.log(`✅ Analysis done for ${job.executionId} (total processed: ${this.stats.processed})`);
    } catch (err) {
      console.error(`❌ Analysis failed for ${job.executionId}:`, err.message);

      if (job.retries < MAX_RETRIES) {
        job.retries++;
        this.stats.retried++;
        const delay = RETRY_DELAY_MS * Math.pow(2, job.retries - 1);
        console.log(`🔄 Retrying ${job.executionId} in ${delay}ms (attempt ${job.retries}/${MAX_RETRIES})`);
        setTimeout(() => {
          this.queue.unshift(job); // put back at front
          if (!this.running) this._processNext();
        }, delay);
      } else {
        this.stats.failed++;
        console.error(`💀 Giving up on ${job.executionId} after ${MAX_RETRIES} retries`);
      }
    }

    // Small gap between jobs to avoid hammering APIs
    setTimeout(() => this._processNext(), 100);
  }

  getStats() {
    return { ...this.stats, pending: this.queue.length, running: this.running };
  }
}

// Singleton — one queue for the whole process
module.exports = new AnalysisQueue();

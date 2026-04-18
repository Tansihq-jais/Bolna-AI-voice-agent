const mongoose = require('mongoose');

class MongoDB {
  static async connect() {
    try {
      let mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        console.log('⚠️  MONGODB_URI not set — insights will be unavailable');
        return;
      }

      // If SRV format, also prepare a fallback without SRV
      // Some networks block SRV DNS lookups
      const connectOptions = {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
        family: 4, // Force IPv4 — avoids IPv6 resolution issues on Windows
      };

      await mongoose.connect(mongoUri, connectOptions);

      console.log('✅ MongoDB Atlas connected — insights ready');

      mongoose.connection.on('error', (err) => {
        console.error('MongoDB error:', err.message);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected — will retry automatically');
      });

      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        process.exit(0);
      });

    } catch (error) {
      console.error('MongoDB connection failed:', error.message);
      console.log('ℹ️  Platform continues without insights — fix MONGODB_URI to enable');
    }
  }

  static isConnected() {
    return mongoose.connection.readyState === 1;
  }

  static async disconnect() {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

module.exports = MongoDB;

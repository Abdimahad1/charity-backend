const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI; // <- matches your .env key
  if (!uri) throw new Error('MONGO_URI not set in .env');
  await mongoose.connect(uri, { autoIndex: true });
  console.log('✅ MongoDB connected');
}

module.exports = connectDB;

const mongoose = require('mongoose');
require('dotenv').config();

async function verify() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/driveaway_udp2';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log('\n======================================');
  console.log('Connected to MongoDB Database:', db.databaseName);
  console.log('URI:', uri);
  console.log('======================================');
  
  const cols = await db.listCollections().toArray();
  for (let col of cols) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`📁 Collection [${col.name}]: ${count} documents`);
  }
  console.log('======================================\n');
  await mongoose.disconnect();
}

verify().catch(e => { console.error('Error:', e.message); process.exit(1); });

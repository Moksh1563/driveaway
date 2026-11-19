const mongoose = require('mongoose');

const mongoUri = () => process.env.MONGO_URI || process.env.MONGODB_URI;

// Connects once and resolves with the connection. Exits the process if the first connect fails,
// so the server never starts listening without a database.
const connectDB = async () => {
  const uri = mongoUri();
  if (!uri) {
    console.error('❌ MONGO_URI is not set. Add it to server/.env (or the host\'s environment settings).');
    process.exit(1);
  }
  try {
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host} (Database: ${conn.connection.name})`);
    return conn.connection;
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

// Later drops (Atlas failover, network blips) reconnect on their own; log them so they are visible
let closing = false;
mongoose.connection.on('disconnected', () => {
  if (!closing) console.warn('⚠️ MongoDB disconnected');
});
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));

// Intentional close (shutdown, end of a script) without the "disconnected" warning
const disconnectDB = async () => {
  closing = true;
  await mongoose.disconnect();
};

module.exports = connectDB;
module.exports.mongoUri = mongoUri;
module.exports.disconnectDB = disconnectDB;

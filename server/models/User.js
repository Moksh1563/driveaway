const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username:          { type: String, unique: true, required: true, trim: true },
  name:              { type: String, required: true },
  email:             { type: String, unique: true, required: true, lowercase: true, trim: true },
  phone:             { type: String, default: '' },
  password:          { type: String, required: true },
  role:              { type: String, enum: ['user', 'admin'], default: 'user' },
  avatar:            { type: String, default: '' },
  // Driver info
  licenseNumber:     { type: String, default: '' },
  dateOfBirth:       { type: Date },
  address:           { type: String, default: '' },
  drivingExperience: { type: Number, default: 0 },
  idProofType:       { type: String, default: '' },
  idProofNumber:     { type: String, default: '' },
  // Emergency
  emergencyContact:  { type: String, default: '' },
  emergencyPhone:    { type: String, default: '' },
  // Loyalty
  loyaltyPoints:     { type: Number, default: 0 },
}, { timestamps: true });

// Never return the password hash unless explicitly asked for
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);

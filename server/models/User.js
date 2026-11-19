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
  // Email preferences: true = no promotional emails (offers, broadcasts)
  marketingOptOut:   { type: Boolean, default: false },
  // Security: tokens issued before this moment are rejected (set on password change/reset)
  passwordChangedAt: { type: Date },
  // Password reset: only the sha256 of the emailed token is stored, never the token itself
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpires:   { type: Date, select: false },
  // Short-lived lock taken while one of this customer's bookings is checked and saved, so the
  // unpaid-booking cap and per-customer code limits hold for simultaneous requests. Never sent to clients.
  bookingLockUntil: { type: Date, select: false },
  bookingLockToken: { type: String, select: false },
}, { timestamps: true });

userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

// Never return the password hash or reset token unless explicitly asked for
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.passwordResetTokenHash;
    delete ret.passwordResetExpires;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);

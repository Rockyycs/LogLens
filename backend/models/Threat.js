const mongoose = require('mongoose');

const threatSchema = new mongoose.Schema({
    ip: String,
    country: String,
    type: String,
    severity: String,
    abuseScore: Number,
    rawLog: String,
    isBlocked: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Threat', threatSchema);

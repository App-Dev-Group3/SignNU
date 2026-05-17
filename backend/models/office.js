const mongoose = require('mongoose');

const OfficeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  imageUrl: { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Office', OfficeSchema);

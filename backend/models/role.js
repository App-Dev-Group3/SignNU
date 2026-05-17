const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  officeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Office', default: null },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
}, { timestamps: true });

RoleSchema.index({ name: 1, officeId: 1, departmentId: 1 }, { unique: true });

module.exports = mongoose.model('Role', RoleSchema);

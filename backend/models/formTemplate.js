const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ApprovalStepSchema = new Schema({
  id: { type: String, required: true },
  role: { type: String, required: true },
  department: { type: String, default: '' },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { _id: false });

const FormTemplateSchema = new Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  pdfUrl: { type: String, required: true },
  imageUrl: { type: String },
  officeId: { type: String },
  officeName: { type: String },
  createdBy: { type: String },
  createdById: { type: String },
  approvalSteps: { type: [ApprovalStepSchema], default: [] },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

module.exports = mongoose.model('FormTemplate', FormTemplateSchema);

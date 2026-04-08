const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AttachmentSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  size: { type: Number, required: true },
  type: { type: String, required: true },
  url: { type: String, required: true },
}, { _id: false });

const ApprovalStepSchema = new Schema({
  id: { type: String, required: true },
  role: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  comments: { type: String },
  timestamp: { type: String },
  isParallel: { type: Boolean, default: false },
}, { _id: false });

const SignatureSchema = new Schema({
  id: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  role: { type: String, required: true },
  signedAt: { type: String, required: true },
  signature: { type: String, required: true },
}, { _id: false });

const SignatureMarkerSchema = new Schema({
  id: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  role: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  page: { type: Number, required: true },
}, { _id: false });

const FormSchema = new Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  aiSummary: { type: String },
  submittedBy: { type: String, required: true },
  submittedById: { type: String, required: true },
  submittedAt: { type: String, required: true },
  status: { type: String, enum: ['draft', 'pending', 'approved', 'rejected', 'completed'], default: 'pending' },
  formData: { type: Schema.Types.Mixed, default: {} },
  attachments: { type: [AttachmentSchema], default: [] },
  approvalSteps: { type: [ApprovalStepSchema], default: [] },
  signatures: { type: [SignatureSchema], default: [] },
  signatureMarkers: { type: [SignatureMarkerSchema], default: [] },
  currentStep: { type: Number, default: 0 },
  lastNudgedAt: { type: String },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Form', FormSchema);

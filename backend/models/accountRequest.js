const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const accountRequestSchema = new Schema({
  firstName: { type: String, required: true, trim: true },
  middleInitial: { type: String, trim: true },
  lastName: { type: String, required: true, trim: true },
  username: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function (value) {
        return /^(?:[A-Za-z0-9._%+-]+@(?:nu-laguna\.edu\.ph|students\.nu-laguna\.edu\.ph))$/.test(value);
      },
      message: 'Email must end with @nu-laguna.edu.ph or @students.nu-laguna.edu.ph',
    },
  },
  password: { type: String, required: true },
  role: { type: String, required: true },
  department: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: { type: Date },
  reviewNote: { type: String, trim: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('AccountRequest', accountRequestSchema);

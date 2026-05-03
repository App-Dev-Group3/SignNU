const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
  id: { type: String, required: true, unique: true },
  formId: { type: String, required: true },
  userId: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new Schema({
  firstName: { type: String, required: true },
  middleInitial: { type: String, trim: true },
  lastName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(value) {
        return /^(?:[A-Za-z0-9._%+-]+@(?:nu-laguna\.edu\.ph|students\.nu-laguna\.edu\.ph))$/.test(value);
      },
      message: 'Email must end with @nu-laguna.edu.ph or @students.nu-laguna.edu.ph'
    }
  },
  password: { type: String, required: true },
  passwordResetToken: { type: String },
  passwordResetTokenExpires: { type: Date },

  role: { type: String, default: 'user' },

  //  NEW FIELD (ACCOUNT APPROVAL) 
  isApproved: {
    type: Boolean,
    default: function () {
      return this.role === "Admin"; // Auto-approve admins
    }
  },

  department: { type: String },
  notifications: [NotificationSchema],
  signatureURL: { type: String },
  pdfURL: { type: String }

}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('User', userSchema);
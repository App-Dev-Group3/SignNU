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
  firstName: { 
    type: String, 
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[A-Za-z\s\-]+$/.test(v); // No numbers/special chars
      },
      message: 'First name must contain only letters'
    }
  },
  middleInitial: { 
    type: String, 
    trim: true,
    uppercase: true,
    maxLength: [1, 'Middle Initial must be 1 character only'],
    validate: {
      validator: function(v) {
        return v === '' || /^[A-Z]$/.test(v); // 1 letter or empty
      },
      message: 'Middle Initial must be a single letter'
    }
  },
  lastName: { 
    type: String, 
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[A-Za-z\s\-]+$/.test(v);
      },
      message: 'Last name must contain only letters'
    }
  },
  username: { type: String, required: true, unique: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(value) {
        return /^(?:[A-Za-z0-9._%+-]+@(?:nu-laguna\.edu\.ph|students\.nu-laguna\.edu\.ph|shs\.students\.nu-laguna\.edu\.ph))$/.test(value);
      },
      message: 'Email must end with @nu-laguna.edu.ph, @students.nu-laguna.edu.ph, or @shs.students.nu-laguna.edu.ph'
    }
  },
  password: { 
    type: String, 
    required: true,
    minlength: [8, 'Password must be at least 8 characters long'],
    // Note: If you are hashing with bcrypt, complexity checks should happen 
    // BEFORE hashing, usually in a pre-save hook or your controller.
  },
  passwordResetToken: { type: String },
  passwordResetTokenExpires: { type: Date },
  passwordResetCode: { type: String },
  passwordResetCodeExpires: { type: Date },

  role: { type: String, default: 'user' },
  roles: { type: [String], default: ['user'] },
  pendingRoleRequests: [
    {
      id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
      role: { type: String, required: true, trim: true },
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      requestedAt: { type: Date, default: Date.now },
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date },
      reviewNote: { type: String, trim: true },
    }
  ],
  userType: {
    type: String,
    enum: ['Employee', 'Student'],
    required: true,
    default: 'Employee',
  },
  isCouncilMember: { type: Boolean, default: false },
  councilRole: { type: String, trim: true },
  employeeRole: { type: String, trim: true },
  organization: { type: String },

  isApproved: {
    type: Boolean,
    default: function () {
      return this.role === "Admin"; 
    }
  },

  department: { type: String },
  notifications: [NotificationSchema],
  signatureURL: { type: String },
  pdfURL: { type: String }

}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('User', userSchema);
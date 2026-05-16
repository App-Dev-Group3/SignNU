const mongoose = require('mongoose');
const Joi = require('joi');
const Schema = mongoose.Schema;

const accountRequestEmailPattern = /^(?:[A-Za-z0-9._%+-]+@(?:nu-laguna\.edu\.ph|students\.nu-laguna\.edu\.ph|shs\.students\.nu-laguna\.edu\.ph))$/;

const accountRequestValidationSchema = Joi.object({
  firstName: Joi.string().trim().min(1).required(),
  middleInitial: Joi.string().trim().uppercase().max(1).allow(''),
  lastName: Joi.string().trim().min(1).required(),
  username: Joi.string().trim().min(1).required(),
  email: Joi.string().trim().lowercase().pattern(accountRequestEmailPattern).required().messages({
    'string.pattern.base': 'Email must end with @nu-laguna.edu.ph or @students.nu-laguna.edu.ph or @shs.students.nu-laguna.edu.ph',
  }),
  password: Joi.string().min(8).required(),
  role: Joi.string().trim().min(1).required(),
  department: Joi.string().trim().min(1).required(),
  organization: Joi.string().trim().allow('').optional(),
  status: Joi.string().valid('pending', 'approved', 'rejected').default('pending'),
  reviewNote: Joi.string().trim().allow(''),
});

const validateAccountRequest = (payload) => accountRequestValidationSchema.validate(payload, {
  abortEarly: false,
  stripUnknown: true,
});

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
        return /^(?:[A-Za-z0-9._%+-]+@(?:nu-laguna\.edu\.ph|students\.nu-laguna\.edu\.ph|shs\.students\.nu-laguna\.edu\.ph))$/.test(value);
      },
      message: 'Email must end with @nu-laguna.edu.ph or @students.nu-laguna.edu.ph or @shs.students.nu-laguna.edu.ph',
    },
  },
  password: { type: String, required: true },
  role: { type: String, required: true },
  department: { type: String, required: true },
  organization: { type: String },
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
module.exports.validateAccountRequest = validateAccountRequest;

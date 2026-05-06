const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const authMiddleware = require('../middleware/authMiddleware.js');
const adminMiddleware = require('../middleware/adminMiddleware.js');
const FormTemplate = require('../models/formTemplate.js');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

cloudinary.config({ secure: true });

const uploadPdfToCloudinary = (buffer, originalName) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: 'templates',
        public_id: `template_${Date.now()}`,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

const generateTemplateId = () => `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeApprovalSteps = (steps) => {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((step) => step && step.role && step.userId && step.userName)
    .map((step, index) => ({
      id: step.id || `step-${Date.now()}-${index}`,
      role: step.role,
      department: step.department || '',
      userId: step.userId,
      userName: step.userName,
      status: step.status || 'pending',
    }));
};

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const templates = await FormTemplate.find({}).sort({ createdAt: -1 });
    return res.status(200).json(templates);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const template = await FormTemplate.findOne({ id: req.params.id });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    return res.status(200).json(template);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', authMiddleware, adminMiddleware, upload.single('pdfFile'), async (req, res) => {
  try {
    const { title, description, type, approvalSteps } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required as pdfFile' });
    }
    if (!title || !type || !description) {
      return res.status(400).json({ error: 'Template type, title, and description are required' });
    }

    let steps = [];
    if (approvalSteps) {
      try {
        steps = normalizeApprovalSteps(JSON.parse(approvalSteps));
      } catch (error) {
        return res.status(400).json({ error: 'Invalid approvalSteps JSON' });
      }
    }

    const uploadResult = await uploadPdfToCloudinary(req.file.buffer, req.file.originalname);
    const pdfUrl = uploadResult.secure_url || uploadResult.url;

    const template = await FormTemplate.create({
      id: generateTemplateId(),
      type,
      title,
      description,
      pdfUrl,
      approvalSteps: steps,
      createdBy: req.user?.name || req.user?.username || req.user?.email || 'Admin',
      createdById: req.user?.id,
    });

    return res.status(201).json(template);
  } catch (error) {
    console.error('Create template failed:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authMiddleware, adminMiddleware, upload.single('pdfFile'), async (req, res) => {
  try {
    const { title, description, type, approvalSteps } = req.body;
    const template = await FormTemplate.findOne({ id: req.params.id });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (title) template.title = title;
    if (description) template.description = description;
    if (type) template.type = type;

    if (approvalSteps) {
      try {
        template.approvalSteps = normalizeApprovalSteps(JSON.parse(approvalSteps));
      } catch (error) {
        return res.status(400).json({ error: 'Invalid approvalSteps JSON' });
      }
    }

    if (req.file) {
      const uploadResult = await uploadPdfToCloudinary(req.file.buffer, req.file.originalname);
      template.pdfUrl = uploadResult.secure_url || uploadResult.url;
    }

    await template.save();
    return res.status(200).json(template);
  } catch (error) {
    console.error('Update template failed:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const template = await FormTemplate.findOneAndDelete({ id: req.params.id });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    return res.status(200).json({ message: 'Template deleted successfully', template });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;

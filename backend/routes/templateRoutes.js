const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const authMiddleware = require('../middleware/authMiddleware.js');
const adminMiddleware = require('../middleware/adminMiddleware.js');
const FormTemplate = require('../models/formTemplate.js');
const Office = require('../models/office.js');

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

const uploadImageToCloudinary = (buffer, originalName) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'template_images',
        public_id: `template_image_${Date.now()}`,
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

const normalizeText = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const isManualDepartmentStep = (department) => {
  const normalized = normalizeText(department);
  return normalized === '__manual_department__' || normalized.includes('manual');
};

const normalizeApprovalSteps = (steps) => {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((step) => step && step.role && (isManualDepartmentStep(step.department) || (step.userId && step.userName)))
    .map((step, index) => ({
      id: step.id || `step-${Date.now()}-${index}`,
      role: step.role,
      department: step.department || '',
      userId: step.userId || '',
      userName: step.userName || '',
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

router.post('/', authMiddleware, adminMiddleware, upload.fields([{ name: 'pdfFile', maxCount: 1 }, { name: 'imageFile', maxCount: 1 }]), async (req, res) => {
  try {
    const { title, description, type, approvalSteps, officeId, officeName, imageUrl } = req.body;

    if (!req.files || !req.files.pdfFile || req.files.pdfFile.length === 0) {
      return res.status(400).json({ error: 'PDF file is required as pdfFile' });
    }
    if (!title || !type || !description || !officeId) {
      return res.status(400).json({ error: 'Template type, title, description, and office are required' });
    }

    let steps = [];
    if (approvalSteps) {
      try {
        steps = normalizeApprovalSteps(JSON.parse(approvalSteps));
      } catch (error) {
        return res.status(400).json({ error: 'Invalid approvalSteps JSON' });
      }
    }

    const pdfFile = req.files.pdfFile[0];
    const uploadResult = await uploadPdfToCloudinary(pdfFile.buffer, pdfFile.originalname);
    const pdfUrl = uploadResult.secure_url || uploadResult.url;

    let finalImageUrl = imageUrl || null;
    if (req.files.imageFile && req.files.imageFile.length > 0) {
      const imageResult = await uploadImageToCloudinary(req.files.imageFile[0].buffer, req.files.imageFile[0].originalname);
      finalImageUrl = imageResult.secure_url || imageResult.url || null;
    }

    const template = await FormTemplate.create({
      id: generateTemplateId(),
      type,
      title,
      description,
      pdfUrl,
      imageUrl: finalImageUrl,
      officeId,
      officeName: officeName || '',
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

router.put('/:id', authMiddleware, adminMiddleware, upload.fields([{ name: 'pdfFile', maxCount: 1 }, { name: 'imageFile', maxCount: 1 }]), async (req, res) => {
  try {
    const { title, description, type, approvalSteps, officeId, officeName, imageUrl, existingImageUrl } = req.body;
    const template = await FormTemplate.findOne({ id: req.params.id });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (title) template.title = title;
    if (description) template.description = description;
    if (type) template.type = type;
    if (officeId) template.officeId = officeId;
    if (officeName) template.officeName = officeName;

    if (approvalSteps) {
      try {
        template.approvalSteps = normalizeApprovalSteps(JSON.parse(approvalSteps));
      } catch (error) {
        return res.status(400).json({ error: 'Invalid approvalSteps JSON' });
      }
    }

    if (req.files) {
      if (req.files.pdfFile && req.files.pdfFile.length > 0) {
        const uploadResult = await uploadPdfToCloudinary(req.files.pdfFile[0].buffer, req.files.pdfFile[0].originalname);
        template.pdfUrl = uploadResult.secure_url || uploadResult.url;
      }
      if (req.files.imageFile && req.files.imageFile.length > 0) {
        const imageResult = await uploadImageToCloudinary(req.files.imageFile[0].buffer, req.files.imageFile[0].originalname);
        template.imageUrl = imageResult.secure_url || imageResult.url || template.imageUrl;
      }
    }

    if (!req.files?.imageFile?.length && typeof existingImageUrl !== 'undefined') {
      template.imageUrl = existingImageUrl || null;
    } else if (!req.files?.imageFile?.length && typeof imageUrl !== 'undefined') {
      template.imageUrl = imageUrl || null;
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

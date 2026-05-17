const Office = require('../models/office.js');
const cloudinary = require('cloudinary').v2;

cloudinary.config({ secure: true });

const DEFAULT_OFFICES = ['SDAO', 'Accounting', 'Admission', 'Faculty', 'Admin'];

const uploadImageToCloudinary = (buffer, originalName) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'offices',
        public_id: `office_${Date.now()}`,
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

const getOffices = async (_req, res) => {
  try {
    let offices = await Office.find({}).sort({ name: 1 });

    if (offices.length === 0) {
      const inserted = await Office.insertMany(
        DEFAULT_OFFICES.map((name) => ({ name })),
        { ordered: false }
      );
      offices = inserted.sort((a, b) => a.name.localeCompare(b.name));
    }

    res.status(200).json(offices.map((office) => ({ id: office._id, name: office.name, imageUrl: office.imageUrl || null })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createOffice = async (req, res) => {
  try {
    const { name, imageUrl } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Office name is required' });
    }

    const existing = await Office.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ error: 'Office already exists' });
    }

    let finalImageUrl = imageUrl || null;
    if (req.file) {
      const uploadResult = await uploadImageToCloudinary(req.file.buffer, req.file.originalname);
      finalImageUrl = uploadResult.secure_url || uploadResult.url || null;
    }

    const office = await Office.create({ name: name.trim(), imageUrl: finalImageUrl });
    res.status(201).json({ id: office._id, name: office.name, imageUrl: office.imageUrl || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateOffice = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, imageUrl } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Office name is required' });
    }

    const duplicate = await Office.findOne({ name: name.trim(), _id: { $ne: id } });
    if (duplicate) {
      return res.status(409).json({ error: 'Another office with this name already exists' });
    }

    let finalImageUrl = imageUrl;
    if (req.file) {
      const uploadResult = await uploadImageToCloudinary(req.file.buffer, req.file.originalname);
      finalImageUrl = uploadResult.secure_url || uploadResult.url || null;
    }

    const updatePayload = { name: name.trim() };
    if (typeof finalImageUrl !== 'undefined') {
      updatePayload.imageUrl = finalImageUrl || null;
    }

    const office = await Office.findByIdAndUpdate(id, updatePayload, { returnDocument: 'after', runValidators: true });
    if (!office) {
      return res.status(404).json({ error: 'Office not found' });
    }

    res.status(200).json({ id: office._id, name: office.name, imageUrl: office.imageUrl || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteOffice = async (req, res) => {
  try {
    const { id } = req.params;
    const office = await Office.findByIdAndDelete(id);
    if (!office) {
      return res.status(404).json({ error: 'Office not found' });
    }

    res.status(200).json({ message: 'Office deleted successfully', id: office._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getOffices,
  createOffice,
  updateOffice,
  deleteOffice,
};

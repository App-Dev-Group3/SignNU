const Form = require('../models/form.js');

const getAllForms = async (req, res) => {
  try {
    const forms = await Form.find({}).sort({ created_at: -1 });
    res.status(200).json(forms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getFormById = async (req, res) => {
  const { id } = req.params;
  try {
    const form = await Form.findOne({ id });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    res.status(200).json(form);
  } catch (error) {
    res.status(400).json({ error: 'Invalid ID format' });
  }
};

const createForm = async (req, res) => {
  try {
    const form = await Form.create(req.body);
    res.status(201).json(form);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateForm = async (req, res) => {
  const { id } = req.params;
  try {
    const form = await Form.findOneAndUpdate({ id }, { ...req.body }, { new: true, runValidators: true });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    res.status(200).json(form);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteForm = async (req, res) => {
  const { id } = req.params;
  try {
    const form = await Form.findOneAndDelete({ id });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    res.status(200).json({ message: 'Form deleted successfully', form });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getAllForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
};

const Department = require('../models/department.js');

const getDepartments = async (_req, res) => {
  try {
    const departments = await Department.find({}).sort({ name: 1 });
    res.status(200).json(departments.map((department) => ({ id: department._id, name: department.name })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const existingDepartment = await Department.findOne({ name: name.trim() });
    if (existingDepartment) {
      return res.status(409).json({ error: 'Department already exists' });
    }

    const department = await Department.create({ name: name.trim() });
    res.status(201).json({ id: department._id, name: department.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const duplicate = await Department.findOne({ name: name.trim(), _id: { $ne: id } });
    if (duplicate) {
      return res.status(409).json({ error: 'Another department with this name already exists' });
    }

    const department = await Department.findByIdAndUpdate(id, { name: name.trim() }, { new: true, runValidators: true });
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.status(200).json({ id: department._id, name: department.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const department = await Department.findByIdAndDelete(id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.status(200).json({ message: 'Department deleted successfully', id: department._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};

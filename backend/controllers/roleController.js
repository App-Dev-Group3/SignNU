const Role = require('../models/role.js');

const getRoles = async (_req, res) => {
  try {
    const roles = await Role.find({}).sort({ name: 1 });
    res.status(200).json(roles.map((role) => ({ id: role._id, name: role.name })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createRole = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const existingRole = await Role.findOne({ name: name.trim() });
    if (existingRole) {
      return res.status(409).json({ error: 'Role already exists' });
    }

    const role = await Role.create({ name: name.trim() });
    res.status(201).json({ id: role._id, name: role.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const duplicate = await Role.findOne({ name: name.trim(), _id: { $ne: id } });
    if (duplicate) {
      return res.status(409).json({ error: 'Another role with this name already exists' });
    }

    const role = await Role.findByIdAndUpdate(id, { name: name.trim() }, { new: true, runValidators: true });
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.status(200).json({ id: role._id, name: role.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findByIdAndDelete(id);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.status(200).json({ message: 'Role deleted successfully', id: role._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
};

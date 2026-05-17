const Role = require('../models/role.js');
const Office = require('../models/office.js');

const getRoles = async (req, res) => {
  try {
    const filter = {};
    if (req.query.officeId) {
      filter.officeId = req.query.officeId;
    }
    const roles = await Role.find(filter).sort({ name: 1 });
    res.status(200).json(roles.map((role) => ({ id: role._id, name: role.name, officeId: role.officeId || null })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createRole = async (req, res) => {
  try {
    const { name, officeId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const normalizedOfficeId = officeId || null;
    if (normalizedOfficeId) {
      const office = await Office.findById(normalizedOfficeId);
      if (!office) {
        return res.status(400).json({ error: 'Office not found' });
      }
    }

    const existingRole = await Role.findOne({ name: name.trim(), officeId: normalizedOfficeId });
    if (existingRole) {
      return res.status(409).json({ error: 'Role already exists for this office' });
    }

    const role = await Role.create({ name: name.trim(), officeId: normalizedOfficeId });
    res.status(201).json({ id: role._id, name: role.name, officeId: role.officeId || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, officeId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const normalizedOfficeId = officeId || null;
    if (normalizedOfficeId) {
      const office = await Office.findById(normalizedOfficeId);
      if (!office) {
        return res.status(400).json({ error: 'Office not found' });
      }
    }

    const duplicate = await Role.findOne({ name: name.trim(), officeId: normalizedOfficeId, _id: { $ne: id } });
    if (duplicate) {
      return res.status(409).json({ error: 'Another role with this name already exists for this office' });
    }

    const role = await Role.findByIdAndUpdate(id, { name: name.trim(), officeId: normalizedOfficeId }, { new: true, runValidators: true });
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.status(200).json({ id: role._id, name: role.name, officeId: role.officeId || null });
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

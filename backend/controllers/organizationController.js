const Organization = require('../models/organization.js');

const getOrganizations = async (_req, res) => {
  try {
    const organizations = await Organization.find({}).sort({ name: 1 });
    res.status(200).json(organizations.map((organization) => ({ id: organization._id, name: organization.name })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createOrganization = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    const existingOrganization = await Organization.findOne({ name: name.trim() });
    if (existingOrganization) {
      return res.status(409).json({ error: 'Organization already exists' });
    }

    const organization = await Organization.create({ name: name.trim() });
    res.status(201).json({ id: organization._id, name: organization.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    const duplicate = await Organization.findOne({ name: name.trim(), _id: { $ne: id } });
    if (duplicate) {
      return res.status(409).json({ error: 'Another organization with this name already exists' });
    }

    const organization = await Organization.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true, runValidators: true }
    );

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.status(200).json({ id: organization._id, name: organization.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = await Organization.findByIdAndDelete(id);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    res.status(200).json({ message: 'Organization deleted successfully', id: organization._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
};

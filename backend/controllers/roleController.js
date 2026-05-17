const Role = require('../models/role.js');
const Office = require('../models/office.js');

const getRoles = async (req, res) => {
  try {
    const filter = {};
    if (req.query.officeId) {
      filter.officeId = req.query.officeId;
    }
    const roles = await Role.find(filter).sort({ name: 1 });
    res.status(200).json(roles.map((role) => ({
      id: role._id,
      name: role.name,
      officeId: role.officeId ? role.officeId.toString() : null,
      departmentId: role.departmentId ? role.departmentId.toString() : null,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createRole = async (req, res) => {
  try {
    const { name, officeId, departmentId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const normalizedOfficeId = officeId || null;
    let office = null;
    if (normalizedOfficeId) {
      office = await Office.findById(normalizedOfficeId);
      if (!office) {
        return res.status(400).json({ error: 'Office not found' });
      }
    }

    const normalizedDepartmentId = departmentId || null;
    const needsDepartment = office?.name.trim().toLowerCase() === 'faculty';
    const departmentIdToSave = needsDepartment ? normalizedDepartmentId : null;

    if (needsDepartment && !departmentIdToSave) {
      return res.status(400).json({ error: 'Department is required for faculty office roles' });
    }
    if (departmentIdToSave) {
      const department = await require('../models/department.js').findById(departmentIdToSave);
      if (!department) {
        return res.status(400).json({ error: 'Department not found' });
      }
    }

    const existingRole = await Role.findOne({ name: name.trim(), officeId: normalizedOfficeId, departmentId: departmentIdToSave });
    if (existingRole) {
      return res.status(409).json({ error: 'Role already exists for this office and department' });
    }

    const role = await Role.create({ name: name.trim(), officeId: normalizedOfficeId, departmentId: departmentIdToSave });
    res.status(201).json({ id: role._id, name: role.name, officeId: role.officeId || null, departmentId: role.departmentId || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, officeId, departmentId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const normalizedOfficeId = officeId || null;
    let office = null;
    if (normalizedOfficeId) {
      office = await Office.findById(normalizedOfficeId);
      if (!office) {
        return res.status(400).json({ error: 'Office not found' });
      }
    }

    const normalizedDepartmentId = departmentId || null;
    const needsDepartment = office?.name.trim().toLowerCase() === 'faculty';
    const departmentIdToSave = needsDepartment ? normalizedDepartmentId : null;

    if (needsDepartment && !departmentIdToSave) {
      return res.status(400).json({ error: 'Department is required for faculty office roles' });
    }
    if (departmentIdToSave) {
      const department = await require('../models/department.js').findById(departmentIdToSave);
      if (!department) {
        return res.status(400).json({ error: 'Department not found' });
      }
    }

    const duplicate = await Role.findOne({ name: name.trim(), officeId: normalizedOfficeId, departmentId: departmentIdToSave, _id: { $ne: id } });
    if (duplicate) {
      return res.status(409).json({ error: 'Another role with this name already exists for this office and department' });
    }

    const role = await Role.findByIdAndUpdate(
      id,
      { name: name.trim(), officeId: normalizedOfficeId, departmentId: departmentIdToSave },
      { new: true, runValidators: true }
    );
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.status(200).json({ id: role._id, name: role.name, officeId: role.officeId || null, departmentId: role.departmentId || null });
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

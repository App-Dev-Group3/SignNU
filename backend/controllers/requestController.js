const Approval = require('../models/approval.js');

// Get all approvals
const getAllApprovals = async (req, res) => {
    try {
        const approvals = await Approval.find({}).sort({ created_at: -1 });
        res.status(200).json(approvals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a specific approval by ID
const getSingleApproval = async (req, res) => {
    const { id } = req.params;
    try {
        const approval = await Approval.findById(id);
        if (!approval) {
            return res.status(404).json({ error: 'Approval not found' });
        }
        res.status(200).json(approval);
    } catch (error) {
        res.status(400).json({ error: 'Invalid ID format' });
    }
};

// Create a new approval
const createApproval = async (req, res) => {
    const { approver_id, meal_request_id, decision = 'pending', comment } = req.body;
    try {
        const approval = await Approval.create({ approver_id, meal_request_id, decision, comment });
        res.status(201).json(approval);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete an approval
const deleteApproval = async (req, res) => {
    const { id } = req.params;
    try {
        const approval = await Approval.findByIdAndDelete(id);
        if (!approval) {
            return res.status(404).json({ error: 'Approval not found' });
        }
        res.status(200).json({ message: 'Deleted successfully', approval });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Update an approval
const updateApproval = async (req, res) => {
    const { id } = req.params;
    try {
        const approval = await Approval.findByIdAndUpdate(id, { ...req.body }, { returnDocument: 'after' });
        if (!approval) {
            return res.status(404).json({ error: 'Approval not found' });
        }
        res.status(200).json(approval);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    getAllApprovals,
    getSingleApproval,
    createApproval,
    deleteApproval,
    updateApproval
};
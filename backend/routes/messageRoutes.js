const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware.js');
const {
  sendMessage,
  getConversation,
  getInbox,
  markMessageRead,
} = require('../controllers/messageController.js');

router.post('/', authMiddleware, sendMessage);
router.get('/inbox', authMiddleware, getInbox);
router.get('/:userId', authMiddleware, getConversation);
router.patch('/:id/read', authMiddleware, markMessageRead);

module.exports = router;

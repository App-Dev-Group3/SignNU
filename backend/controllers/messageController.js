const crypto = require('crypto');
const Message = require('../models/message.js');
const User = require('../models/user.js');

const MESSAGE_SECRET = process.env.MESSAGE_ENCRYPTION_KEY || 'signnu-default-message-key';
const MESSAGE_KEY = crypto.scryptSync(MESSAGE_SECRET, 'signnu-salt', 32);

const encryptText = (text) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MESSAGE_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decryptText = (ciphertext) => {
  try {
    const [ivHex, tagHex, encryptedHex] = ciphertext.split(':');
    if (!ivHex || !tagHex || !encryptedHex) {
      return ciphertext;
    }
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', MESSAGE_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    return ciphertext;
  }
};

const sendMessage = async (req, res) => {
  const { recipientId, text } = req.body;
  const senderId = req.user?.id;

  if (!recipientId || !text?.trim()) {
    return res.status(400).json({ error: 'recipientId and text are required.' });
  }

  if (!senderId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (senderId.toString() === recipientId.toString()) {
    return res.status(400).json({ error: 'Cannot send a message to yourself.' });
  }

  try {
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found.' });
    }

    const encryptedText = encryptText(text.trim());
    const message = await Message.create({
      senderId,
      recipientId,
      text: encryptedText,
      read: false,
    });

    const responseMessage = message.toObject();
    responseMessage.text = text.trim();

    return res.status(201).json({ message: 'Message sent successfully.', data: responseMessage });
  } catch (error) {
    console.error('sendMessage failed:', error);
    return res.status(500).json({ error: error.message });
  }
};

const getInbox = async (req, res) => {
  const currentUserId = req.user?.id;

  if (!currentUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const messages = await Message.find({
      $or: [{ senderId: currentUserId }, { recipientId: currentUserId }],
    })
      .sort({ createdAt: -1 })
      .populate('senderId', 'username email role')
      .populate('recipientId', 'username email role');

    const conversations = {};
    messages.forEach((message) => {
      const sender = message.senderId;
      const recipient = message.recipientId;
      const senderId = sender?._id?.toString();
      const recipientId = recipient?._id?.toString();
      const partner = senderId === currentUserId ? recipient : sender;
      if (!partner) return;

      const partnerId = partner._id.toString();
      if (!conversations[partnerId]) {
        conversations[partnerId] = {
          partnerId,
          username: partner.username,
          email: partner.email,
          role: partner.role,
          latestText: decryptText(message.text),
          latestAt: message.createdAt,
          unreadCount: 0,
        };
      }

      if (message.recipientId?._id?.toString() === currentUserId && !message.read) {
        conversations[partnerId].unreadCount += 1;
      }
    });

    return res.status(200).json({ data: Object.values(conversations) });
  } catch (error) {
    console.error('getInbox failed:', error);
    return res.status(500).json({ error: error.message });
  }
};

const getConversation = async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user?.id;

  if (!currentUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    await Message.updateMany(
      { senderId: userId, recipientId: currentUserId, read: false },
      { read: true }
    );

    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, recipientId: userId },
        { senderId: userId, recipientId: currentUserId },
      ],
    }).sort({ createdAt: 1 });

    const decryptedMessages = messages.map((message) => ({
      ...message.toObject(),
      text: decryptText(message.text),
    }));

    return res.status(200).json({ data: decryptedMessages });
  } catch (error) {
    console.error('getConversation failed:', error);
    return res.status(500).json({ error: error.message });
  }
};

const markMessageRead = async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user?.id;

  if (!currentUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    if (message.recipientId.toString() !== currentUserId.toString()) {
      return res.status(403).json({ error: 'Only the recipient can mark this message as read.' });
    }

    message.read = true;
    await message.save();

    return res.status(200).json({ message: 'Message marked as read.', data: message });
  } catch (error) {
    console.error('markMessageRead failed:', error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  sendMessage,
  getConversation,
  getInbox,
  markMessageRead,
};

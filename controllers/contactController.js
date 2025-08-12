const ContactMessage = require('../models/ContactMessage');

// POST - Create a new contact message
exports.createMessage = async (req, res) => {
  try {
    const newMessage = new ContactMessage(req.body);
    await newMessage.save();
    res.status(201).json({ message: 'Message sent successfully', data: newMessage });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send message', error: err.message });
  }
};

// GET - All messages
exports.getMessages = async (_req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
};

// GET - Single message
exports.getMessageById = async (req, res) => {
  try {
    const msg = await ContactMessage.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch message' });
  }
};

// PUT - Update full message
exports.updateMessage = async (req, res) => {
  try {
    const updated = await ContactMessage.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: 'Message updated', data: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update message' });
  }
};

// PATCH - Partial update
exports.patchMessage = async (req, res) => {
  try {
    const updated = await ContactMessage.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: 'Message patched', data: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to patch message' });
  }
};

// DELETE - Remove a message
exports.deleteMessage = async (req, res) => {
  try {
    const deleted = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete message' });
  }
};

const express = require('express');
const router = express.Router();
const {
  createMessage,
  getMessages,
  getMessageById,
  updateMessage,
  patchMessage,
  deleteMessage
} = require('../controllers/contactController');

// Create
router.post('/send', createMessage);

// Read
router.get('/', getMessages);
router.get('/:id', getMessageById);

// Update
router.put('/:id', updateMessage);
router.patch('/:id', patchMessage);

// Delete
router.delete('/:id', deleteMessage);

module.exports = router;

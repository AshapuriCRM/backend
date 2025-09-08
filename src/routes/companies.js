const express = require('express');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Placeholder routes - will be implemented later
router.get('/', protect, (req, res) => {
  res.json({ success: true, message: 'Companies route working' });
});

module.exports = router;
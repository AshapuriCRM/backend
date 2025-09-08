const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    cb(null, `${baseName}-${uniqueSuffix}${extension}`);
  }
});

// File filter to accept specific file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-excel': '.xls',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'text/csv': '.csv'
  };

  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${Object.values(allowedTypes).join(', ')}`), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 1 // Only allow one file at a time
  }
});

// Middleware for single file upload
const uploadSingle = upload.single('file');

// Wrapper middleware with enhanced error handling
const uploadMiddleware = (req, res, next) => {
  uploadSingle(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 10MB'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          error: 'Too many files. Only one file allowed'
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          error: 'Unexpected field name. Use "file" as field name'
        });
      }
      return res.status(400).json({
        success: false,
        error: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please select a file.'
      });
    }

    // Add file info to request
    req.fileInfo = {
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      size: req.file.size,
      fileType: getFileType(req.file.originalname)
    };

    next();
  });
};

// Helper function to determine file type
const getFileType = (fileName) => {
  const extension = path.extname(fileName).toLowerCase();
  switch (extension) {
    case '.pdf':
      return 'pdf';
    case '.xlsx':
    case '.xls':
      return 'excel';
    case '.jpg':
    case '.jpeg':
    case '.png':
      return 'image';
    case '.csv':
      return 'csv';
    default:
      return 'unknown';
  }
};

// Clean up uploaded files (utility function)
const cleanupFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up file: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error cleaning up file ${filePath}:`, error);
  }
};

module.exports = {
  uploadMiddleware,
  cleanupFile,
  getFileType,
  uploadsDir
};
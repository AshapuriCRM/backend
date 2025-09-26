const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const xlsx = require('xlsx');
const path = require('path');
const { protect } = require('../middleware/auth');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Excel, and image files are allowed.'));
    }
  }
}).single('file');

// MIME type mapping
const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf'
};

// AI Prompt for data extraction
const AI_PROMPT = `
You are a data extraction specialist. Extract the following information:
1. Names of people/employees
2. Present days (attendance days)
3. Total days (total working days) or Absent (absent or absent days) or zero (0) if not present

Rules:
- Extract ALL names and their corresponding attendance data
- If data is in table format, extract from each row
- If data is handwritten/unstructured, identify patterns like "Name X/Y" or "Name X Y"
- Handle variations in handwriting and formatting
- Return ONLY valid JSON format

Required JSON format:
{
    "extracted_data": [
        {
            "name": "Person Name",
            "present_day": number,
            "total_day": number
        }
    ]
}

If you cannot extract certain information, use null for missing values.
`;

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// @desc    Process attendance file with Gemini AI
// @route   POST /api/ai/upload
// @access  Private
const processAttendanceFile = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      console.log('Processing file:', req.file.originalname, 'Size:', req.file.size);

      try {
        // Check if Gemini API key is configured
        if (!process.env.GEMINI_API_KEY) {
          return res.status(500).json({
            success: false,
            error: 'Gemini API key not configured'
          });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const fileExt = path.extname(req.file.originalname).toLowerCase();
        let response;

        if (fileExt === '.xlsx' || fileExt === '.xls') {
          console.log('Processing Excel file...');
          
          // Process Excel file
          const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const csvData = xlsx.utils.sheet_to_csv(worksheet);
          
          const fullPrompt = `${AI_PROMPT}\n\nSpreadsheet data:\n${csvData}`;
          response = await model.generateContent(fullPrompt);
          
        } else if (MIME_MAP[fileExt]) {
          console.log(`Processing ${fileExt} file with MIME type ${MIME_MAP[fileExt]}...`);
          
          // Process image/PDF file
          const fileData = {
            inlineData: {
              data: req.file.buffer.toString('base64'),
              mimeType: MIME_MAP[fileExt]
            }
          };
          
          response = await model.generateContent([AI_PROMPT, fileData]);
          
        } else {
          return res.status(400).json({
            success: false,
            error: `Unsupported file type: ${fileExt}`
          });
        }

        console.log('Gemini AI response received');
        
        const responseText = response.response.text();
        
        try {
          // Try to parse as JSON first
          const jsonResult = JSON.parse(responseText);
          console.log('Gemini response parsed as JSON:', jsonResult);
          
          return res.status(200).json({
            success: true,
            result: jsonResult
          });
          
        } catch (jsonError) {
          console.log('Gemini response is not valid JSON. Returning raw text.');
          
          // If not valid JSON, return the raw text
          return res.status(200).json({
            success: true,
            result: responseText
          });
        }

      } catch (aiError) {
        console.error('AI Processing Error:', aiError.message);
        
        return res.status(500).json({
          success: false,
          error: 'AI processing failed: ' + aiError.message
        });
      }
    });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
};

// Apply authentication middleware
router.use(protect);

// @route   POST /api/ai/upload
// @desc    Process attendance file with AI
// @access  Private
router.post('/upload', processAttendanceFile);

// @route   GET /api/ai/status
// @desc    Check AI service status
// @access  Private
router.get('/status', async (req, res) => {
  try {
    const hasApiKey = !!process.env.GEMINI_API_KEY;
    
    if (!hasApiKey) {
      return res.status(503).json({
        success: false,
        message: 'AI service not configured - missing Gemini API key',
        configured: false
      });
    }

    // Test AI connection with a simple prompt
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    await model.generateContent("Hello");
    
    res.status(200).json({
      success: true,
      message: 'AI service is online and configured',
      configured: true
    });
    
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'AI service error: ' + error.message,
      configured: false
    });
  }
});

module.exports = router;
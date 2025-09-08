const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

/**
 * Process uploaded attendance file using external AI API
 * @param {string} filePath - Path to the uploaded file
 * @param {object} fileInfo - File information object
 * @returns {Promise<object>} Processed attendance data
 */
const processAttendanceFile = async (filePath, fileInfo) => {
  try {
    console.log(`Processing file: ${fileInfo.originalName}`);
    
    // For now, we'll use the external AI API (same as frontend)
    // TODO: Later this can be replaced with local AI processing
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath), {
      filename: fileInfo.originalName,
      contentType: fileInfo.mimeType
    });

    const response = await axios.post(
      'https://ai-invoice-generator-python.onrender.com/upload/',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 60000, // 60 seconds timeout
      }
    );

    if (response.data && response.data.result) {
      // Clean the response (remove markdown formatting)
      const cleaned = response.data.result.replace(/```json|```/g, '');
      const parsed = JSON.parse(cleaned);
      
      // Validate and normalize the extracted data
      const extractedData = normalizeExtractedData(parsed.extracted_data || []);
      
      return {
        success: true,
        extractedData,
        rawResponse: response.data,
        processingStatus: 'completed',
        processedAt: new Date()
      };
    } else {
      throw new Error('Invalid response from AI processing service');
    }
  } catch (error) {
    console.error('File processing error:', error);
    
    // If AI processing fails, try to provide a fallback or meaningful error
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return {
        success: false,
        error: 'File processing timeout. Please try again with a smaller file.',
        processingStatus: 'failed',
        processedAt: new Date()
      };
    }
    
    if (error.response && error.response.status >= 500) {
      return {
        success: false,
        error: 'AI processing service is temporarily unavailable. Please try again later.',
        processingStatus: 'failed',
        processedAt: new Date()
      };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to process attendance file',
      processingStatus: 'failed',
      processedAt: new Date()
    };
  }
};

/**
 * Normalize extracted attendance data
 * @param {Array} rawData - Raw extracted data from AI
 * @returns {Array} Normalized data
 */
const normalizeExtractedData = (rawData) => {
  if (!Array.isArray(rawData)) {
    console.warn('Invalid extracted data format, expected array');
    return [];
  }

  return rawData.map((entry, index) => {
    // Normalize field names and ensure required fields exist
    const normalized = {
      id: entry.id || `emp_${index + 1}`,
      name: entry.name || entry.employee_name || `Employee ${index + 1}`,
      presentDays: parseFloat(entry.present_day || entry.presentDays || entry.days_present || 0),
      totalDays: parseFloat(entry.total_day || entry.totalDays || entry.days_total || 30),
      absentDays: 0,
      attendanceRate: 0
    };

    // Calculate absent days and attendance rate
    normalized.absentDays = normalized.totalDays - normalized.presentDays;
    normalized.attendanceRate = normalized.totalDays > 0 
      ? parseFloat(((normalized.presentDays / normalized.totalDays) * 100).toFixed(1))
      : 0;

    // Add validation flags
    normalized.isValid = !!(normalized.name && normalized.presentDays >= 0 && normalized.totalDays > 0);
    
    return normalized;
  }).filter(entry => entry.isValid); // Filter out invalid entries
};

/**
 * Simulate AI processing for testing/development
 * @param {object} fileInfo - File information
 * @returns {Promise<object>} Mock processed data
 */
const simulateAIProcessing = async (fileInfo) => {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Generate mock attendance data
  const mockData = [];
  const employeeCount = Math.floor(Math.random() * 10) + 5; // 5-15 employees
  
  for (let i = 1; i <= employeeCount; i++) {
    const totalDays = 30;
    const presentDays = Math.floor(Math.random() * 8) + 22; // 22-30 days
    
    mockData.push({
      id: `emp_${i}`,
      name: `Employee ${i}`,
      presentDays,
      totalDays,
      absentDays: totalDays - presentDays,
      attendanceRate: parseFloat(((presentDays / totalDays) * 100).toFixed(1)),
      isValid: true
    });
  }
  
  return {
    success: true,
    extractedData: mockData,
    processingStatus: 'completed',
    processedAt: new Date(),
    isSimulated: true
  };
};

/**
 * Validate file for processing
 * @param {object} fileInfo - File information
 * @returns {object} Validation result
 */
const validateFileForProcessing = (fileInfo) => {
  const errors = [];
  
  // Check file size (max 10MB)
  if (fileInfo.size > 10 * 1024 * 1024) {
    errors.push('File size exceeds 10MB limit');
  }
  
  // Check file type
  const supportedTypes = ['pdf', 'excel', 'csv', 'image'];
  if (!supportedTypes.includes(fileInfo.fileType)) {
    errors.push(`Unsupported file type: ${fileInfo.fileType}. Supported types: ${supportedTypes.join(', ')}`);
  }
  
  // Check if file exists
  if (!fs.existsSync(fileInfo.filePath)) {
    errors.push('Uploaded file not found');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Get processing status for a file
 * @param {string} fileName - Name of the file
 * @returns {object} Processing status
 */
const getProcessingStatus = (fileName) => {
  // This would typically check a database or cache
  // For now, return a default status
  return {
    status: 'pending',
    progress: 0,
    message: 'File queued for processing'
  };
};

module.exports = {
  processAttendanceFile,
  normalizeExtractedData,
  simulateAIProcessing,
  validateFileForProcessing,
  getProcessingStatus
};
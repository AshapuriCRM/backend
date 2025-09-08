const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const employeeRoutes = require('./routes/employees');
const invoiceRoutes = require('./routes/invoiceRoutes');
const categoryRoutes = require('./routes/categories');
const salaryRoutes = require('./routes/salaries');
const documentRoutes = require('./routes/documents');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Security Middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Ashapuri CRM API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/documents', documentRoutes);

// Catch 404 and forward to error handler
app.all('*', (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.status = 404;
  next(error);
});

// Global error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Ashapuri CRM API Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
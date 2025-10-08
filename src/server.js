const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const connectDB = require("./config/database");
const errorHandler = require("./middleware/errorHandler");

// Import routes
const authRoutes = require("./routes/auth");
const companyRoutes = require("./routes/companies");
const employeeRoutes = require("./routes/employees");
const aiRoutes = require("./routes/aiRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const salaryRoutes = require("./routes/salaryRoutes");
const companyFolderRoutes = require("./routes/companyFolderRoutes");
// const categoryRoutes = require('./routes/categories');
// const documentRoutes = require('./routes/documents');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Security Middleware
app.use(helmet());

// CORS configuration - Allow all origins for development
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        process.env.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "https://frontend-34r69it9n-ashapuricrms-projects.vercel.app",
        "https://frontend-git-yatharth-ashapuricrms-projects.vercel.app",
      ].filter(Boolean);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // For development, allow any localhost origin
      if (
        process.env.NODE_ENV === "development" &&
        origin.includes("localhost")
      ) {
        return callback(null, true);
      }

      const msg =
        "The CORS policy for this site does not allow access from the specified Origin.";
      return callback(new Error(msg), false);
    },
    credentials: true,
  })
);

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression middleware
app.use(compression());

// Ensure logs directory exists
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create write streams for log files
const accessLogStream = fs.createWriteStream(path.join(logsDir, "access.log"), {
  flags: "a",
});
const errorLogStream = fs.createWriteStream(path.join(logsDir, "error.log"), {
  flags: "a",
});

// Custom morgan format with timestamp
const logFormat =
  ':date[iso] :method :url :status :res[content-length] - :response-time ms ":user-agent"';

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev")); // Console logging for development
  app.use(morgan(logFormat, { stream: accessLogStream })); // File logging
} else {
  app.use(morgan("combined", { stream: accessLogStream })); // File logging for production
}

// Error logging function
const logError = (error, req = null) => {
  const timestamp = new Date().toISOString();
  const errorLog = {
    timestamp,
    error: {
      message: error.message,
      stack: error.stack,
      status: error.status || 500,
    },
    request: req
      ? {
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        }
      : null,
  };

  errorLogStream.write(JSON.stringify(errorLog) + "\n");
};

// Make logError available globally
global.logError = logError;

// Static files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Ashapuri CRM API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Root route for platform health checks
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Ashapuri CRM API is running",
    health: "/health",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});
app.head("/", (req, res) => res.status(200).end());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/salary", salaryRoutes);
app.use("/api/company-folders", companyFolderRoutes);
// app.use('/api/categories', categoryRoutes);
// app.use('/api/documents', documentRoutes);

// Catch 404 and forward to error handler
app.all("*", (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.status = 404;
  next(error);
});

// Global error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Ashapuri CRM API Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(
    `🌐 CORS enabled for: localhost:3000, localhost:3001, localhost:3002`
  );
});

module.exports = app;

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads directory for employee photos exists
const employeePhotosDir = path.join(__dirname, "../../uploads/employee-photos");
if (!fs.existsSync(employeePhotosDir)) {
  fs.mkdirSync(employeePhotosDir, { recursive: true });
}

// Multer storage for photos
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, employeePhotosDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9-_]/g, "_");
    cb(null, `${baseName}-${uniqueSuffix}${extension}`);
  },
});

// Only allow common image types
const imageFileFilter = (_req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  console.warn(`[Upload] Rejected file type: ${file.mimetype}`);
  cb(new Error("Invalid image type. Only JPEG, PNG, or WEBP allowed."));
};

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_IMAGE_SIZE || "5242880", 10), // default 5MB
    files: 1,
  },
});

// Optional single photo upload from field name "photo"
const uploadEmployeePhotoOptional = (req, res, next) => {
  const handler = upload.single("photo");
  handler(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      console.error(`[Upload][MulterError] code=${err.code}, message=${err.message}`);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ success: false, error: "Image too large. Max size is 5MB." });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res
          .status(400)
          .json({
            success: false,
            error: "Too many files. Only one image allowed.",
          });
      }
      return res
        .status(400)
        .json({ success: false, error: `Upload error: ${err.message}` });
    } else if (err) {
      console.error(`[Upload][Error] ${err.message}`);
      return res.status(400).json({ success: false, error: err.message });
    }
    // Note: file is optional; when absent, continue without error
    if (req.file) {
      console.log(
        `[Upload] Received employee photo: ${req.file.originalname} -> ${req.file.filename} (${req.file.mimetype}, ${req.file.size} bytes)`
      );
    } else {
      console.log("[Upload] No photo file provided in request.");
    }
    return next();
  });
};

module.exports = { uploadEmployeePhotoOptional, employeePhotosDir };

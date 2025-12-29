const express = require("express");
const router = express.Router({ mergeParams: true });
const multer = require("multer");
const { protect } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const {
  validateIds,
  validateFolderId,
  validateFileId,
  validateCreateFolder,
  validateRenameFolder,
  validateRenameFile,
  createFolder,
  getFolders,
  getFolderById,
  uploadFiles,
  downloadFile,
  renameFolder,
  renameFile,
  deleteFile,
  deleteFolder,
} = require("../controllers/companyFolderController");

// Multer memory storage for direct Cloudinary upload with file type filter
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "image/jpeg",
      "image/png",
      "image/jpg",
      "text/csv",
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error("Invalid file type. Allowed: PDF, Excel, Images, CSV"));
  },
}).array("files", 10); // field name: files, up to 10

// Apply auth for all routes here
router.use(protect);

// @route   POST /api/company-folders/:companyId/folders
// @desc    Create a folder under a company
// @params  companyId (path)
// @body    { folder_name: string }
router.post(
  "/:companyId/folders",
  validateCreateFolder,
  validate,
  createFolder
);

// @route   GET /api/company-folders/:companyId/folders
// @desc    Get all folders for a company
// @params  companyId (path)
// @query   page, limit
router.get("/:companyId/folders", validateIds, validate, getFolders);

// @route   GET /api/company-folders/:companyId/folders/:folderId
// @desc    Get a folder by id with files
// @params  companyId, folderId
router.get(
  "/:companyId/folders/:folderId",
  validateFolderId,
  validate,
  getFolderById
);

// @route   POST /api/company-folders/:companyId/folders/:folderId/files
// @desc    Upload single or multiple files to a folder
// @params  companyId, folderId
// @body    multipart/form-data with field "files"
router.post(
  "/:companyId/folders/:folderId/files",
  validateFolderId,
  validate,
  (req, res, next) =>
    upload(req, res, (err) => {
      if (err)
        return res.status(400).json({ success: false, error: err.message });
      next();
    }),
  uploadFiles
);

// @route   GET /api/company-folders/:companyId/folders/:folderId/files/:fileId/download
// @desc    Download a file (redirect to Cloudinary secure URL)
router.get(
  "/:companyId/folders/:folderId/files/:fileId/download",
  validateFileId,
  validate,
  downloadFile
);

// @route   PATCH /api/company-folders/:companyId/folders/:folderId
// @desc    Rename a folder
// @body    { folder_name }
router.patch(
  "/:companyId/folders/:folderId",
  validateRenameFolder,
  validate,
  renameFolder
);

// @route   PATCH /api/company-folders/:companyId/folders/:folderId/files/:fileId
// @desc    Rename a file
// @body    { name }
router.patch(
  "/:companyId/folders/:folderId/files/:fileId",
  validateRenameFile,
  validate,
  renameFile
);

// @route   DELETE /api/company-folders/:companyId/folders/:folderId/files/:fileId
// @desc    Delete a file
router.delete(
  "/:companyId/folders/:folderId/files/:fileId",
  validateFileId,
  validate,
  deleteFile
);

// @route   DELETE /api/company-folders/:companyId/folders/:folderId
// @desc    Delete a folder (soft delete)
router.delete(
  "/:companyId/folders/:folderId",
  validateFolderId,
  validate,
  deleteFolder
);

module.exports = router;

const { validationResult, param, body } = require("express-validator");
const mongoose = require("mongoose");
const CompanyFolder = require("../models/CompanyFolder");
const cloudinary = require("../config/cloudinary");
const { getFileType } = require("../middleware/upload");

// Helper: convert bytes to string (store as string per schema)
const toSizeString = (bytes) => String(bytes || 0);

// Helper: parse Cloudinary URL to extract resource_type and public_id
// Supports URLs like:
// - https://res.cloudinary.com/<cloud_name>/<resource_type>/upload/v<ver>/<public_id>.<ext>
// - https://res.cloudinary.com/<resource_type>/upload/v<ver>/<public_id>.<ext>
function parseCloudinaryUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);

    let resourceType = "raw";
    let publicIdWithExt = "";

    // Find the index of 'upload'
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx > 0) {
      resourceType = parts[uploadIdx - 1] || "raw";
      // After 'upload' we usually have version segment like v123
      const afterUpload = parts[uploadIdx + 1] || "";
      const hasVersion = afterUpload.startsWith("v");
      const startIdx = uploadIdx + (hasVersion ? 2 : 1);
      publicIdWithExt = parts.slice(startIdx).join("/");
    } else if (parts.length >= 3) {
      // Fallback to common pattern with cloud_name present
      // [cloud_name, resource_type, upload, vX, ...]
      resourceType = parts[1] || "raw";
      publicIdWithExt = parts.slice(4).join("/");
    }

    const lastDot = publicIdWithExt.lastIndexOf(".");
    const publicId =
      lastDot !== -1 ? publicIdWithExt.substring(0, lastDot) : publicIdWithExt;
    return { resource_type: resourceType, public_id: publicId || null };
  } catch (e) {
    return { resource_type: "raw", public_id: null };
  }
}

// Helper: upload a buffer to Cloudinary using streams
const streamUpload = (buffer, filename, folder, resourceType) => {
  return new Promise((resolve, reject) => {
    const options = {
      resource_type: resourceType || "auto",
      folder,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    };
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    // Write buffer
    uploadStream.end(buffer);
  });
};

// Validation chains (exported for routes)
const validateIds = [
  param("companyId").isMongoId().withMessage("Invalid companyId"),
];

const validateFolderId = [
  ...validateIds,
  param("folderId").isMongoId().withMessage("Invalid folderId"),
];

const validateFileId = [
  ...validateFolderId,
  param("fileId").isMongoId().withMessage("Invalid fileId"),
];

const validateCreateFolder = [
  ...validateIds,
  body("folder_name")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("folder_name is required and must be <= 50 chars"),
];

const validateRenameFolder = [
  ...validateFolderId,
  body("folder_name")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("folder_name is required and must be <= 50 chars"),
];

const validateRenameFile = [
  ...validateFileId,
  body("name")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("name is required"),
];

// @desc    Create a folder under a company
// @route   POST /api/company-folders/:companyId/folders
// @params  companyId: string (path)
// @body    { folder_name: string }
// @access  Private
async function createFolder(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { companyId } = req.params;
    const { folder_name } = req.body;

    const folder = await CompanyFolder.create({
      folder_name,
      company_id: companyId,
      soft_delete: false,
      files: [],
    });

    return res.status(201).json({ success: true, data: folder });
  } catch (error) {
    console.error("Create folder error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Error creating folder",
      });
  }
}

// @desc    Get all folders for a company
// @route   GET /api/company-folders/:companyId/folders
// @params  companyId: string (path)
// @query   page?: number, limit?: number, includeDeleted?: boolean
// @access  Private
async function getFolders(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { companyId } = req.params;
    const { page = 1, limit = 20, includeDeleted = "false" } = req.query;

    const query = { company_id: companyId };
    if (includeDeleted !== "true") {
      query.soft_delete = false;
    }

    const folders = await CompanyFolder.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const total = await CompanyFolder.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        folders,
        pagination: { total, page: Number(page), limit: Number(limit) },
      },
    });
  } catch (error) {
    console.error("Get folders error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Error fetching folders",
      });
  }
}

// @desc    Get a folder and its files
// @route   GET /api/company-folders/:companyId/folders/:folderId
// @params  companyId: string (path), folderId: string (path)
// @access  Private
async function getFolderById(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { companyId, folderId } = req.params;

    const folder = await CompanyFolder.findOne({
      _id: folderId,
      company_id: companyId,
    });
    if (!folder || folder.soft_delete) {
      return res
        .status(404)
        .json({ success: false, error: "Folder not found" });
    }

    return res.status(200).json({ success: true, data: folder });
  } catch (error) {
    console.error("Get folder error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Error fetching folder",
      });
  }
}

// @desc    Upload one or more files to a folder (uploaded to Cloudinary)
// @route   POST /api/company-folders/:companyId/folders/:folderId/files
// @params  companyId: string (path), folderId: string (path)
// @body    multipart/form-data with field "files" (single or multiple)
// @access  Private
async function uploadFiles(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { companyId, folderId } = req.params;

    const folder = await CompanyFolder.findOne({
      _id: folderId,
      company_id: companyId,
    });
    if (!folder || folder.soft_delete) {
      return res
        .status(404)
        .json({ success: false, error: "Folder not found" });
    }

    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No files uploaded" });
    }

    const uploaded = [];
    for (const file of req.files) {
      const fileType = getFileType(file.originalname);
      const resourceType =
        fileType === "image" ? "image" : fileType === "pdf" ? "raw" : "raw";
      const cloudFolder = `company-files/${companyId}/${folderId}`;
      const result = await streamUpload(
        file.buffer,
        file.originalname,
        cloudFolder,
        resourceType
      );

      const newFile = {
        name: file.originalname,
        size: toSizeString(file.size),
        file_type: fileType,
        created_by: req.user._id,
        file_url: result.secure_url,
        created_at: new Date(),
        updated_at: new Date(),
      };
      folder.files.push(newFile);
      uploaded.push(newFile);
    }

    await folder.save();

    return res
      .status(201)
      .json({
        success: true,
        data: { uploadedCount: uploaded.length, files: uploaded },
      });
  } catch (error) {
    console.error("Upload files error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Error uploading files",
      });
  }
}

// @desc    Download a file (redirect to Cloudinary URL)
// @route   GET /api/company-folders/:companyId/folders/:folderId/files/:fileId/download
// @params  companyId: string, folderId: string, fileId: string
// @access  Private
async function downloadFile(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { companyId, folderId, fileId } = req.params;

    const folder = await CompanyFolder.findOne({
      _id: folderId,
      company_id: companyId,
    }).lean();
    if (!folder || folder.soft_delete) {
      return res
        .status(404)
        .json({ success: false, error: "Folder not found" });
    }

    const file = (folder.files || []).find(
      (f) => String(f._id) === String(fileId)
    );
    if (!file) {
      return res.status(404).json({ success: false, error: "File not found" });
    }

    // Temporary: redirect to Cloudinary URL for download
    return res.status(302).redirect(file.file_url);
  } catch (error) {
    console.error("Download file error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Error downloading file",
      });
  }
}

// @desc    Rename a folder
// @route   PATCH /api/company-folders/:companyId/folders/:folderId
// @params  companyId: string, folderId: string
// @body    { folder_name: string }
// @access  Private
async function renameFolder(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { companyId, folderId } = req.params;
    const { folder_name } = req.body;

    const folder = await CompanyFolder.findOne({
      _id: folderId,
      company_id: companyId,
    });
    if (!folder || folder.soft_delete) {
      return res
        .status(404)
        .json({ success: false, error: "Folder not found" });
    }

    folder.folder_name = folder_name;
    await folder.save();

    return res.status(200).json({ success: true, data: folder });
  } catch (error) {
    console.error("Rename folder error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Error renaming folder",
      });
  }
}

// @desc    Rename a file (DB only)
// @route   PATCH /api/company-folders/:companyId/folders/:folderId/files/:fileId
// @params  companyId: string, folderId: string, fileId: string
// @body    { name: string }
// @access  Private
async function renameFile(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { companyId, folderId, fileId } = req.params;
    const { name } = req.body;

    const folder = await CompanyFolder.findOne({
      _id: folderId,
      company_id: companyId,
    });
    if (!folder || folder.soft_delete) {
      return res
        .status(404)
        .json({ success: false, error: "Folder not found" });
    }

    const file = folder.files.id(fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: "File not found" });
    }

    file.name = name;
    file.updated_at = new Date();
    await folder.save();

    return res.status(200).json({ success: true, data: file });
  } catch (error) {
    console.error("Rename file error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Error renaming file" });
  }
}

// @desc    Delete a file (from DB and Cloudinary if possible)
// @route   DELETE /api/company-folders/:companyId/folders/:folderId/files/:fileId
// @params  companyId: string, folderId: string, fileId: string
// @access  Private
async function deleteFile(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { companyId, folderId, fileId } = req.params;

    const folder = await CompanyFolder.findOne({
      _id: folderId,
      company_id: companyId,
    });
    if (!folder || folder.soft_delete) {
      return res
        .status(404)
        .json({ success: false, error: "Folder not found" });
    }

    const file = folder.files.id(fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: "File not found" });
    }

    const { public_id, resource_type } = parseCloudinaryUrl(
      file.file_url || ""
    );
    try {
      if (public_id) {
        await cloudinary.uploader.destroy(public_id, {
          resource_type: resource_type || "raw",
        });
      }
    } catch (cldErr) {
      console.warn("Cloudinary delete error (continuing):", cldErr.message);
    }

    file.deleteOne();
    await folder.save();

    return res.status(200).json({ success: true, message: "File deleted" });
  } catch (error) {
    console.error("Delete file error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Error deleting file" });
  }
}

// @desc    Delete a folder (soft delete + optionally delete files from Cloudinary)
// @route   DELETE /api/company-folders/:companyId/folders/:folderId
// @params  companyId: string, folderId: string
// @access  Private
async function deleteFolder(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { companyId, folderId } = req.params;

    const folder = await CompanyFolder.findOne({
      _id: folderId,
      company_id: companyId,
    });
    if (!folder) {
      return res
        .status(404)
        .json({ success: false, error: "Folder not found" });
    }

    // Try deleting files from Cloudinary
    for (const f of folder.files || []) {
      const { public_id, resource_type } = parseCloudinaryUrl(f.file_url || "");
      try {
        if (public_id) {
          await cloudinary.uploader.destroy(public_id, {
            resource_type: resource_type || "raw",
          });
        }
      } catch (e) {
        console.warn("Cloudinary delete error for file:", f.name, e.message);
      }
    }

    // Soft delete folder
    folder.soft_delete = true;
    await folder.save();

    return res.status(200).json({ success: true, message: "Folder deleted" });
  } catch (error) {
    console.error("Delete folder error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Error deleting folder",
      });
  }
}

module.exports = {
  // validators
  validateIds,
  validateFolderId,
  validateFileId,
  validateCreateFolder,
  validateRenameFolder,
  validateRenameFile,
  // controllers
  createFolder,
  getFolders,
  getFolderById,
  uploadFiles,
  downloadFile,
  renameFolder,
  renameFile,
  deleteFile,
  deleteFolder,
};

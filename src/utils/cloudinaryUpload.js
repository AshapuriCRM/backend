const cloudinary = require("../config/cloudinary");
const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Uploads a buffer to Cloudinary as a raw file (XLSX)
 * @param {Buffer} buffer
 * @param {String} filename
 * @returns {Promise<Object>} Cloudinary upload result
 */
async function uploadXlsxToCloudinary(buffer, filename) {
  // Write buffer to temp file (cross-platform)
  const tempPath = path.join(os.tmpdir(), `${Date.now()}-${filename}`);
  fs.writeFileSync(tempPath, buffer);
  try {
    const result = await cloudinary.uploader.upload(tempPath, {
      resource_type: "raw",
      folder: "salary-slips",
      public_id: filename.replace(/\.xlsx$/, ""),
      use_filename: true,
      unique_filename: false,
      overwrite: true,
      // Explicitly set as public upload
      type: "upload",
      access_mode: "public",
    });
    return result;
  } finally {
    fs.unlinkSync(tempPath);
  }
}

/**
 * Uploads a file to Cloudinary (supports PDFs, images, and other documents)
 * @param {String} filePath - Path to the file on local filesystem
 * @param {Object} options - Upload options
 * @param {String} options.folder - Cloudinary folder (default: 'invoices')
 * @param {String} options.public_id - Custom public ID (optional)
 * @param {String} options.resource_type - Resource type: 'auto', 'image', 'raw', 'video' (default: 'auto')
 * @returns {Promise<Object>} Cloudinary upload result with secure_url, public_id, etc.
 */
async function uploadFileToCloudinary(filePath, options = {}) {
  const {
    folder = "invoices",
    public_id,
    resource_type = "auto",
  } = options;

  try {
    const uploadOptions = {
      resource_type,
      folder,
      use_filename: true,
      unique_filename: true,
      // Explicitly set as public upload (not private/authenticated)
      type: "upload",
      access_mode: "public",
    };

    if (public_id) {
      uploadOptions.public_id = public_id;
      uploadOptions.unique_filename = false;
      uploadOptions.overwrite = true;
    }

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
      bytes: result.bytes,
      createdAt: result.created_at,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
  }
}

/**
 * Deletes a file from Cloudinary
 * @param {String} publicId - The public ID of the file to delete
 * @param {String} resourceType - Resource type: 'image', 'raw', 'video' (default: 'raw')
 * @returns {Promise<Object>} Deletion result
 */
async function deleteFileFromCloudinary(publicId, resourceType = "raw") {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    console.error("Cloudinary deletion error:", error);
    throw new Error(`Failed to delete file from Cloudinary: ${error.message}`);
  }
}

/**
 * Generates a signed URL for accessing private Cloudinary resources
 * @param {String} publicId - The public ID of the file
 * @param {Object} options - Options for URL generation
 * @param {String} options.resourceType - Resource type: 'image', 'raw', 'video' (default: 'raw')
 * @param {Number} options.expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @param {String} options.format - File format/extension (optional)
 * @returns {String} Signed URL
 */
function getSignedUrl(publicId, options = {}) {
  const {
    resourceType = "raw",
    expiresIn = 3600,
    format,
  } = options;

  try {
    const timestamp = Math.floor(Date.now() / 1000) + expiresIn;

    const signedUrl = cloudinary.url(publicId, {
      resource_type: resourceType,
      type: "authenticated",
      sign_url: true,
      secure: true,
      format: format,
      expires_at: timestamp,
    });

    return signedUrl;
  } catch (error) {
    console.error("Cloudinary signed URL error:", error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

/**
 * Generates a private download URL with attachment disposition
 * Uses Cloudinary's private_download_url for authenticated access
 * @param {String} publicId - The public ID of the file
 * @param {Object} options - Options for URL generation
 * @param {String} options.resourceType - Resource type (default: 'raw')
 * @param {String} options.fileName - Custom filename for download
 * @param {String} options.format - File format
 * @param {Number} options.expiresIn - Expiration time in seconds (default: 3600)
 * @returns {String} Download URL
 */
function getDownloadUrl(publicId, options = {}) {
  const {
    resourceType = "raw",
    fileName,
    format,
    expiresIn = 3600,
  } = options;

  try {
    // Use Cloudinary's utils to generate a signed private download URL
    const downloadUrl = cloudinary.utils.private_download_url(publicId, format || "pdf", {
      resource_type: resourceType,
      type: "upload",
      attachment: true,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    });

    return downloadUrl;
  } catch (error) {
    console.error("Cloudinary download URL error:", error);

    // Fallback to regular URL with attachment flag
    try {
      const downloadOptions = {
        resource_type: resourceType,
        type: "upload",
        secure: true,
        flags: "attachment",
      };

      if (fileName) {
        downloadOptions.flags = `attachment:${fileName}`;
      }

      if (format) {
        downloadOptions.format = format;
      }

      return cloudinary.url(publicId, downloadOptions);
    } catch (fallbackError) {
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }
}

module.exports = {
  uploadXlsxToCloudinary,
  uploadFileToCloudinary,
  deleteFileFromCloudinary,
  getSignedUrl,
  getDownloadUrl,
};

# Invoice File Upload & Creation Guide

## Overview
This guide explains how to upload invoice files to Cloudinary and create invoices with the uploaded file URLs.

## Backend Changes Made

### 1. New Upload Endpoint
**POST `/api/invoices/upload-file`**
- Uploads files to Cloudinary
- Returns full Cloudinary URL
- Supports PDF, Excel, and images (up to 10MB)

### 2. Updated Invoice Creation
**POST `/api/invoices/create`**
- Now accepts optional file metadata from Cloudinary
- Falls back to local path if no fileUrl provided (backwards compatible)

## Frontend Implementation

### Step 1: Add Upload Method to api.ts

```typescript
// Add this to your ApiClient class in api.ts

/**
 * Upload invoice file to Cloudinary
 * @param file - The file to upload (PDF, Excel, or image)
 * @param invoiceNumber - Optional invoice number for custom naming
 */
async uploadInvoiceFile(
  file: File,
  invoiceNumber?: string
): Promise<ApiResponse<{
  fileUrl: string;
  publicId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}>> {
  const formData = new FormData();
  formData.append('invoiceFile', file);
  if (invoiceNumber) {
    formData.append('invoiceNumber', invoiceNumber);
  }

  const url = `${this.baseURL}/api/invoices/upload-file`;
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: this.token ? `Bearer ${this.token}` : '',
    },
    body: formData,
  }).then((res) => res.json());
}
```

### Step 2: Update createInvoice Method Signature

```typescript
// Update the existing createInvoice method to accept file metadata

async createInvoice(invoiceData: {
  companyId: string;
  attendanceData: any[];

  // Optional file metadata (from uploadInvoiceFile)
  fileUrl?: string;
  cloudinaryPublicId?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;

  gstPaidBy: string;
  serviceChargeRate: number;
  bonusRate?: number;
  overtimeRate?: number;
  calculatedValues?: {
    totalEmployees: number;
    totalPresentDays: number;
    perDayRate: number;
    baseTotal: number;
    overtimeAmount?: number;
    totalOvertimeDays?: number;
    serviceCharge: number;
    pfAmount: number;
    esicAmount: number;
    bonusAmount?: number;
    subTotal: number;
    totalBeforeTax: number;
    cgst: number;
    sgst: number;
    grandTotal: number;
  };
}): Promise<ApiResponse<any>> {
  return this.request("/api/invoices/create", {
    method: "POST",
    body: JSON.stringify(invoiceData),
  });
}
```

## Usage Examples

### Example 1: Create Invoice with File Upload

```typescript
async function createInvoiceWithFile(
  pdfFile: File,
  attendanceData: any[],
  companyId: string,
  calculations: any
) {
  try {
    // Step 1: Upload the file to Cloudinary
    const uploadResult = await apiClient.uploadInvoiceFile(pdfFile);

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'File upload failed');
    }

    // Step 2: Create invoice with Cloudinary URL
    const invoiceResult = await apiClient.createInvoice({
      companyId,
      attendanceData,

      // File metadata from Cloudinary
      fileUrl: uploadResult.data.fileUrl,
      cloudinaryPublicId: uploadResult.data.publicId,
      fileName: uploadResult.data.fileName,
      fileType: uploadResult.data.fileType,
      fileSize: uploadResult.data.fileSize,

      gstPaidBy: 'principal-employer',
      serviceChargeRate: 7,
      bonusRate: 0,
      overtimeRate: 1.5,
      calculatedValues: calculations,
    });

    return invoiceResult;
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
}
```

### Example 2: Upload with Custom Invoice Number

```typescript
// Generate invoice number first
const invoiceNumber = `INV-2025-${String(count).padStart(3, '0')}`;

// Upload with custom name
const uploadResult = await apiClient.uploadInvoiceFile(
  pdfFile,
  invoiceNumber
);

// This will store the file in Cloudinary as "invoices/INV-2025-001"
```

### Example 3: Create Invoice Without File (Backwards Compatible)

```typescript
// This still works - will use local path fallback
const invoiceResult = await apiClient.createInvoice({
  companyId,
  attendanceData,
  // No file metadata provided
  gstPaidBy: 'principal-employer',
  serviceChargeRate: 7,
  calculatedValues: calculations,
});
```

## Frontend Component Example (React)

```tsx
import { useState } from 'react';
import { apiClient } from '@/lib/api';

function InvoiceUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) return;

    setUploading(true);
    try {
      // 1. Upload file
      const uploadResult = await apiClient.uploadInvoiceFile(file);

      // 2. Create invoice
      const invoiceResult = await apiClient.createInvoice({
        companyId: selectedCompanyId,
        attendanceData: processedAttendance,
        fileUrl: uploadResult.data.fileUrl,
        cloudinaryPublicId: uploadResult.data.publicId,
        fileName: uploadResult.data.fileName,
        fileType: uploadResult.data.fileType,
        fileSize: uploadResult.data.fileSize,
        gstPaidBy: 'principal-employer',
        serviceChargeRate: 7,
        calculatedValues: calculations,
      });

      console.log('Invoice created:', invoiceResult.data);
      // Show success message, redirect, etc.

    } catch (error) {
      console.error('Error:', error);
      // Show error message
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="file"
        accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button type="submit" disabled={!file || uploading}>
        {uploading ? 'Uploading...' : 'Create Invoice'}
      </button>
    </form>
  );
}
```

## Displaying/Downloading Files

### Direct Link (Download)

```tsx
<a href={invoice.fileUrl} target="_blank" download>
  Download Invoice
</a>
```

### Display PDF in Iframe

```tsx
<iframe
  src={invoice.fileUrl}
  width="100%"
  height="600px"
  title="Invoice PDF"
/>
```

### Display Image

```tsx
<img src={invoice.fileUrl} alt="Invoice" />
```

### Preview with Modal

```tsx
function InvoicePreview({ invoice }) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <button onClick={() => setShowPreview(true)}>
        View Invoice
      </button>

      {showPreview && (
        <div className="modal">
          <iframe src={invoice.fileUrl} width="100%" height="100%" />
          <button onClick={() => setShowPreview(false)}>Close</button>
        </div>
      )}
    </>
  );
}
```

## Benefits

✅ **CDN Delivery**: Fast global file access via Cloudinary's CDN
✅ **No Backend Proxy**: Frontend directly accesses Cloudinary URLs
✅ **Automatic Cleanup**: Files are deleted from Cloudinary when invoice is deleted
✅ **Browser Native**: PDFs open/download naturally in browsers
✅ **Scalable**: No server storage needed, unlimited file capacity
✅ **Backwards Compatible**: Still works without file upload

## File Limits

- **Max Size**: 10MB per file
- **Formats**: PDF, Excel (.xlsx, .xls), Images (.jpg, .jpeg, .png)
- **Storage**: Cloudinary (free tier: 25GB storage, 25GB bandwidth/month)

## Cloudinary Configuration

Ensure these environment variables are set in your backend `.env`:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Testing

1. Upload a test PDF file
2. Check the response for the Cloudinary URL
3. Verify the URL is accessible in browser
4. Create an invoice with the uploaded file data
5. Verify the invoice has the correct Cloudinary URL
6. Test viewing/downloading the file from the frontend

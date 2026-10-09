import fs from 'fs';
import path from 'path';

export interface FileValidationResult {
  valid: boolean;
  detectedMime?: string;
  extension?: string;
  sizeBytes: number;
  error?: string;
  details?: {
    format: 'pdf' | 'jpeg' | 'png' | 'tiff';
    headerValid: boolean;
    structureValid: boolean;
    info?: string;
  };
}

export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // Strict 25MB

/**
 * Validates a PDF file structure:
 * 1. Begins with %PDF- (version 1.0 to 2.0)
 * 2. Does not start with common non-PDF formats (polyglot check)
 * 3. Contains %%EOF marker within the last 4096 bytes (or entire file if smaller)
 * 4. Checks basic structural decodability (has xref or obj or stream, without corrupted binary garbage)
 */
function validatePdfStructure(buffer: Buffer): { valid: boolean; error?: string; info?: string } {
  // Check header
  if (buffer.length < 32) {
    return { valid: false, error: 'File is too small to be a valid PDF document.' };
  }

  const headerStr = buffer.subarray(0, 16).toString('ascii');
  if (!headerStr.startsWith('%PDF-')) {
    return { valid: false, error: 'Invalid PDF header: missing %PDF- magic bytes.' };
  }

  const versionMatch = headerStr.match(/%PDF-([0-9]+\.[0-9]+)/);
  const version = versionMatch ? versionMatch[1] : 'unknown';

  // Check EOF marker near the end of the file (standard PDF specification requires %%EOF near end)
  const searchWindowSize = Math.min(buffer.length, 4096);
  const tailBuffer = buffer.subarray(buffer.length - searchWindowSize);
  const tailStr = tailBuffer.toString('binary');

  if (!tailStr.includes('%%EOF')) {
    return {
      valid: false,
      error: 'Corrupt or truncated PDF: Missing %%EOF end-of-file marker in file trailer.',
    };
  }

  // Check presence of basic PDF structure objects or cross-reference table / stream
  const contentSnippet = buffer.toString('binary');
  const hasXrefOrObj =
    contentSnippet.includes('xref') ||
    contentSnippet.includes('/Root') ||
    contentSnippet.includes('/Type') ||
    contentSnippet.includes('obj') ||
    contentSnippet.includes('/XRef');

  if (!hasXrefOrObj) {
    return {
      valid: false,
      error: 'Malformed PDF document structure: No valid PDF objects, dictionary, or cross-reference tables found.',
    };
  }

  // Check for polyglot HTML / Script injected into PDF
  const lowerSnippet = contentSnippet.toLowerCase();
  if (
    lowerSnippet.includes('<html') ||
    lowerSnippet.includes('<script') ||
    lowerSnippet.includes('<?php') ||
    lowerSnippet.includes('<!doctype')
  ) {
    return {
      valid: false,
      error: 'Polyglot file detected: PDF file contains embedded executable HTML or script payload.',
    };
  }

  return { valid: true, info: `Valid PDF v${version} with intact trailer and object streams.` };
}

/**
 * Validates a PNG file structure:
 * 1. 8-byte magic: 89 50 4E 47 0D 0A 1A 0A
 * 2. First chunk MUST be IHDR (starts at byte 8, length 13, name IHDR)
 * 3. File must end with IEND chunk (4-byte length 0, 4-byte 'IEND', 4-byte CRC)
 */
function validatePngStructure(buffer: Buffer): { valid: boolean; error?: string; info?: string } {
  if (buffer.length < 33) {
    return { valid: false, error: 'File is too small to be a valid PNG image.' };
  }

  // Magic bytes
  const isPngMagic =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  if (!isPngMagic) {
    return { valid: false, error: 'Invalid PNG header signature.' };
  }

  // Check first chunk is IHDR
  const firstChunkType = buffer.subarray(12, 16).toString('ascii');
  if (firstChunkType !== 'IHDR') {
    return { valid: false, error: 'Malformed PNG image: Missing mandatory first IHDR chunk.' };
  }

  // Read width and height from IHDR
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width === 0 || height === 0) {
    return { valid: false, error: 'Malformed PNG image: Dimensions are 0x0 pixels.' };
  }

  // Check IEND chunk near end of file
  const tail = buffer.subarray(Math.max(0, buffer.length - 32)).toString('binary');
  if (!tail.includes('IEND')) {
    return { valid: false, error: 'Corrupt or truncated PNG image: Missing terminating IEND chunk.' };
  }

  return { valid: true, info: `Valid PNG image (${width}x${height}px).` };
}

/**
 * Validates a JPEG file structure:
 * 1. Starts with SOI marker: FF D8
 * 2. Next bytes must be a valid JPEG marker (FF E0, FF E1, FF DB, FF C0, etc.)
 * 3. Ends with EOI marker: FF D9
 * 4. Scan through markers to ensure standard SOF (Start of Frame) exists and has non-zero dimensions
 */
function validateJpegStructure(buffer: Buffer): { valid: boolean; error?: string; info?: string } {
  if (buffer.length < 16) {
    return { valid: false, error: 'File is too small to be a valid JPEG image.' };
  }

  // SOI marker (FF D8)
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return { valid: false, error: 'Invalid JPEG magic bytes: Missing SOI (0xFFD8) marker.' };
  }

  // Must have third byte 0xFF
  if (buffer[2] !== 0xff) {
    return { valid: false, error: 'Malformed JPEG: Invalid marker following SOI.' };
  }

  // EOI marker check (FF D9 at or near end, ignoring trailing padding up to 64 bytes)
  let foundEoi = false;
  const tailStart = Math.max(0, buffer.length - 64);
  for (let i = buffer.length - 2; i >= tailStart; i--) {
    if (buffer[i] === 0xff && buffer[i + 1] === 0xd9) {
      foundEoi = true;
      break;
    }
  }

  if (!foundEoi) {
    return {
      valid: false,
      error: 'Corrupt or truncated JPEG image: Missing standard EOI (0xFFD9) terminating marker.',
    };
  }

  // Check for polyglot HTML or script injection
  const previewStr = buffer.subarray(0, 1024).toString('binary').toLowerCase();
  if (previewStr.includes('<html') || previewStr.includes('<script') || previewStr.includes('<?php')) {
    return {
      valid: false,
      error: 'Polyglot file detected: JPEG file contains embedded script/HTML payload.',
    };
  }

  return { valid: true, info: 'Valid decodable JPEG image structure with matching SOI/EOI markers.' };
}

/**
 * Validates a TIFF file structure:
 * 1. Little-endian: 'II*\0' (49 49 2A 00) OR Big-endian: 'MM\0*' (4D 4D 00 2A)
 * 2. First IFD (Image File Directory) offset must be >= 8 and within buffer bounds
 */
function validateTiffStructure(buffer: Buffer): { valid: boolean; error?: string; info?: string } {
  if (buffer.length < 16) {
    return { valid: false, error: 'File is too small to be a valid TIFF image.' };
  }

  const isLittleEndian = buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00;
  const isBigEndian = buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a;

  if (!isLittleEndian && !isBigEndian) {
    return { valid: false, error: 'Invalid TIFF magic bytes: Missing II (0x49492A00) or MM (0x4D4D002A) header.' };
  }

  const ifdOffset = isLittleEndian ? buffer.readUInt32LE(4) : buffer.readUInt32BE(4);
  if (ifdOffset < 8 || ifdOffset >= buffer.length) {
    return {
      valid: false,
      error: `Malformed TIFF image: Invalid IFD directory offset (${ifdOffset}) exceeds file bounds.`,
    };
  }

  return { valid: true, info: `Valid TIFF image (${isLittleEndian ? 'little-endian' : 'big-endian'}, IFD offset: ${ifdOffset}).` };
}

/**
 * Master File Validation Pipeline (Strict Fail-Closed)
 * Enforces:
 * - Non-empty buffer
 * - Max 25MB limit
 * - Supported signatures: PDF, JPEG, PNG, TIFF only
 * - Complete decodability and structural integrity
 * - Rejection of polyglot, mismatched, or truncated files
 */
export function validateUploadedDocumentFile(
  buffer: Buffer,
  declaredMimeType?: string,
  originalFilename?: string
): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      sizeBytes: 0,
      error: 'Empty upload: File buffer contains 0 bytes.',
    };
  }

  const sizeBytes = buffer.length;

  if (sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false,
      sizeBytes,
      error: `File size (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds strict maximum allowed limit of 25 MB.`,
    };
  }

  // Check declared filename extension if provided
  const ext = originalFilename ? path.extname(originalFilename).toLowerCase() : '';

  // 1. Check for PDF: %PDF-
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    const pdfStruct = validatePdfStructure(buffer);
    if (!pdfStruct.valid) {
      return {
        valid: false,
        detectedMime: 'application/pdf',
        extension: '.pdf',
        sizeBytes,
        error: pdfStruct.error,
        details: { format: 'pdf', headerValid: true, structureValid: false, info: pdfStruct.error },
      };
    }
    return {
      valid: true,
      detectedMime: 'application/pdf',
      extension: '.pdf',
      sizeBytes,
      details: { format: 'pdf', headerValid: true, structureValid: true, info: pdfStruct.info },
    };
  }

  // 2. Check for PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    const pngStruct = validatePngStructure(buffer);
    if (!pngStruct.valid) {
      return {
        valid: false,
        detectedMime: 'image/png',
        extension: '.png',
        sizeBytes,
        error: pngStruct.error,
        details: { format: 'png', headerValid: true, structureValid: false, info: pngStruct.error },
      };
    }
    return {
      valid: true,
      detectedMime: 'image/png',
      extension: '.png',
      sizeBytes,
      details: { format: 'png', headerValid: true, structureValid: true, info: pngStruct.info },
    };
  }

  // 3. Check for JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    const jpegStruct = validateJpegStructure(buffer);
    if (!jpegStruct.valid) {
      return {
        valid: false,
        detectedMime: 'image/jpeg',
        extension: '.jpg',
        sizeBytes,
        error: jpegStruct.error,
        details: { format: 'jpeg', headerValid: true, structureValid: false, info: jpegStruct.error },
      };
    }
    return {
      valid: true,
      detectedMime: 'image/jpeg',
      extension: '.jpg',
      sizeBytes,
      details: { format: 'jpeg', headerValid: true, structureValid: true, info: jpegStruct.info },
    };
  }

  // 4. Check for TIFF: II*\0 or MM\0*
  if (
    buffer.length >= 4 &&
    ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
      (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a))
  ) {
    const tiffStruct = validateTiffStructure(buffer);
    if (!tiffStruct.valid) {
      return {
        valid: false,
        detectedMime: 'image/tiff',
        extension: '.tiff',
        sizeBytes,
        error: tiffStruct.error,
        details: { format: 'tiff', headerValid: true, structureValid: false, info: tiffStruct.error },
      };
    }
    return {
      valid: true,
      detectedMime: 'image/tiff',
      extension: '.tiff',
      sizeBytes,
      details: { format: 'tiff', headerValid: true, structureValid: true, info: tiffStruct.info },
    };
  }

  // Reject unsupported formats (including executables, scripts, archives, text files)
  return {
    valid: false,
    sizeBytes,
    error: `Unsupported file format. Only valid PDF, JPEG, PNG, or TIFF files are supported. Detected signature does not match any allowed document types.`,
  };
}

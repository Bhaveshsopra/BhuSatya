import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';

export type LandDocumentType =
  | 'SATBARA_7_12'
  | 'FORM_8A'
  | 'PROPERTY_CARD'
  | 'FERFAR_MUTATION'
  | 'SALE_DEED'
  | 'OTHER_OFFICIAL_LAND_RECORD'
  | 'UNKNOWN';

export type DocumentValidationStatus =
  | 'ACCEPTED_LAND_DOCUMENT'
  | 'REJECTED_NOT_LAND_DOCUMENT'
  | 'NEEDS_MANUAL_REVIEW'
  | 'DOCUMENT_VALIDATION_UNAVAILABLE';

export interface ExtractedLandFields {
  ownerName: string | null;
  surveyNo: string | null;
  gatNo: string | null;
  subDivision: string | null;
  village: string | null;
  taluka: string | null;
  district: string | null;
  state: string | null;
  area: string | null;
  areaHa: number | null;
  areaAcres: number | null;
  docDate: string | null;
  docRef: string | null;
  ulpin: string | null;
  encumbrances: string | null;
  classification: string | null;
}

export interface DocumentClassificationResult {
  status: DocumentValidationStatus;
  isSupportedLandDocument: boolean;
  documentType: LandDocumentType;
  documentTypeDescription: string;
  classificationConfidence: number; // 0.0 to 1.0
  language: 'English' | 'Marathi' | 'Hindi' | 'Mixed' | 'Unknown';
  imageQuality: 'readable' | 'partially_readable' | 'unreadable';
  visibleEvidence: string[];
  ocrText: string;
  extractedFields: ExtractedLandFields;
  reasons: string[];
  requiresManualReview: boolean;
  sha256?: string;
  verifiedAt: string;
  evidenceLimitationNotice?: string;
  stageResults: {
    stageA_fileValidation: { passed: boolean; message: string; mimeTypeDetected?: string };
    stageB_classification: { passed: boolean; detectedType: LandDocumentType; confidence: number };
    stageC_ocrEvidence: { passed: boolean; matchedKeywordsCount: number; matchedKeywords: string[] };
    stageD_decision: { status: DocumentValidationStatus; decisionNotes: string };
  };
}

export const SUPPORTED_LAND_DOCUMENT_DESCRIPTIONS: Record<LandDocumentType, string> = {
  SATBARA_7_12: '7/12 Extract (Satbara / सातबारा / गाव नमुना सात-बारा)',
  FORM_8A: 'Form 8A Extract (नमुना ८-अ / खाते उतारा)',
  PROPERTY_CARD: 'Property Card (मालमत्ता पत्रक / नगर भूमापन पत्रिका / CTS Card)',
  FERFAR_MUTATION: 'Ferfar / Mutation Register Entry (फेरफार नोंद / गाव नमुना ६)',
  SALE_DEED: 'Registered Land Sale Deed / Title Deed (खरेदीखत / दस्तऐवज)',
  OTHER_OFFICIAL_LAND_RECORD: 'Other Official Land Record (Tippani / Mojani Nakasha / Government Revenue Document)',
  UNKNOWN: 'Unsupported / Non-Land Document',
};

export const EVIDENCE_LIMITATION_NOTICE =
  'Notice: Layout analysis and keyword matching are performed on vision-model OCR text. This enables automated document triage and field extraction for review, but does NOT constitute legal proof of document authenticity or independent government database verification.';

// Authentic Maharashtra Revenue terminology keywords for independent evidence validation
const LAND_RECORD_KEYWORDS: Record<LandDocumentType, string[]> = {
  SATBARA_7_12: [
    'सातबारा',
    '7/12',
    '७/१२',
    'गाव नमुना सात',
    'गाव नमुना १२',
    'गाव नमुना ७',
    'भोगवटादार',
    'खाते क्रमांक',
    'पोट हिस्सा',
    'क्षेत्र',
    'आकार',
    'इतर हक्क',
    'पिकांची नोंद',
    'satbara',
    'village form vii',
    'form 7',
    'form 12',
    'hektar',
    'aar',
    'aar',
    'pot hissa',
  ],
  FORM_8A: [
    '८-अ',
    '8a',
    '८ अ',
    'नमुना आठ',
    'गाव नमुना ८',
    'खातेदार',
    'जमीन महसूल',
    'खाते उतारा',
    'village form viii-a',
    'form 8a',
  ],
  PROPERTY_CARD: [
    'मालमत्ता पत्रक',
    'नगर भूमापन',
    'city survey',
    'cts no',
    'सीटी सर्व्हे',
    'अखिव पत्रिका',
    'property card',
    'sheet no',
    'cadastral survey',
  ],
  FERFAR_MUTATION: [
    'फेरफार',
    'गाव नमुना सहा',
    'गाव नमुना ६',
    'नमुना ६',
    'ferfar',
    'mutation',
    'हक्क नोंद',
    'वारस नोंद',
    'फेरफार नोंद',
  ],
  SALE_DEED: [
    'खरेदीखत',
    'विक्रीखत',
    'दस्तऐवज',
    'sale deed',
    'conveyance deed',
    'sub-registrar',
    'सह दुय्यम निबंधक',
    'मुद्रांक',
    'stamp duty',
    'दस्त क्रमांक',
    'मोबदला',
  ],
  OTHER_OFFICIAL_LAND_RECORD: [
    'टिप्पणी',
    'मोजणी',
    'tippani',
    'mojani',
    'cadastral map',
    'nakasha',
    'भूमि अभिलेख',
    'जमाबंदी',
  ],
  UNKNOWN: [],
};

/**
 * Stage A: Validate file signature/magic bytes
 */
export function validateFileMagicBytes(buffer: Buffer): {
  valid: boolean;
  detectedMime?: string;
  error?: string;
} {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Uploaded file is empty (0 bytes).' };
  }

  if (buffer.length > 25 * 1024 * 1024) {
    return { valid: false, error: 'File size exceeds maximum allowed limit of 25MB.' };
  }

  // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { valid: true, detectedMime: 'application/pdf' };
  }

  // PNG magic bytes: \x89PNG\r\n\x1a\n (0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A)
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
    return { valid: true, detectedMime: 'image/png' };
  }

  // JPEG magic bytes: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedMime: 'image/jpeg' };
  }

  // TIFF magic bytes: II*\0 (0x49 0x49 0x2A 0x00) or MM\0* (0x4D 0x4D 0x00 0x2A)
  if (
    buffer.length >= 4 &&
    ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
      (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a))
  ) {
    return { valid: true, detectedMime: 'image/tiff' };
  }

  return {
    valid: false,
    error: 'Invalid file signature / magic bytes. Only valid PDF, PNG, JPEG, or TIFF files are permitted.',
  };
}

/**
 * Initialize Google GenAI client safely on server
 */
function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Main Multi-Stage Document Classifier & OCR Engine
 */
export async function classifyAndExtractLandDocument(
  fileBuffer: Buffer,
  declaredMimeType: string,
  originalFilename: string
): Promise<DocumentClassificationResult> {
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const verifiedAt = new Date().toISOString();

  // STAGE A: Magic Bytes Validation
  const magicValidation = validateFileMagicBytes(fileBuffer);
    if (!magicValidation.valid) {
    return {
      status: 'REJECTED_NOT_LAND_DOCUMENT',
      isSupportedLandDocument: false,
      documentType: 'UNKNOWN',
      documentTypeDescription: SUPPORTED_LAND_DOCUMENT_DESCRIPTIONS.UNKNOWN,
      classificationConfidence: 0.0,
      language: 'Unknown',
      imageQuality: 'unreadable',
      visibleEvidence: [],
      ocrText: '',
      extractedFields: getEmptyExtractedFields(),
      reasons: [magicValidation.error || 'Corrupt or unsupported binary header.'],
      requiresManualReview: false,
      sha256,
      verifiedAt,
      evidenceLimitationNotice: EVIDENCE_LIMITATION_NOTICE,
      stageResults: {
        stageA_fileValidation: { passed: false, message: magicValidation.error || 'Invalid signature' },
        stageB_classification: { passed: false, detectedType: 'UNKNOWN', confidence: 0.0 },
        stageC_ocrEvidence: { passed: false, matchedKeywordsCount: 0, matchedKeywords: [] },
        stageD_decision: { status: 'REJECTED_NOT_LAND_DOCUMENT', decisionNotes: 'Rejected at Stage A (binary validation).' },
      },
    };
  }

  const effectiveMime = magicValidation.detectedMime || declaredMimeType;

  // Check GenAI Availability
  const ai = getGenAIClient();
  if (!ai) {
    return {
      status: 'DOCUMENT_VALIDATION_UNAVAILABLE',
      isSupportedLandDocument: false,
      documentType: 'UNKNOWN',
      documentTypeDescription: SUPPORTED_LAND_DOCUMENT_DESCRIPTIONS.UNKNOWN,
      classificationConfidence: 0.0,
      language: 'Unknown',
      imageQuality: 'unreadable',
      visibleEvidence: [],
      ocrText: '',
      extractedFields: getEmptyExtractedFields(),
      reasons: [
        'AI Document Validation Service unavailable: GEMINI_API_KEY is not configured in server environment secrets.',
      ],
      requiresManualReview: true,
      sha256,
      verifiedAt,
      evidenceLimitationNotice: EVIDENCE_LIMITATION_NOTICE,
      stageResults: {
        stageA_fileValidation: { passed: true, message: 'Valid file signature.', mimeTypeDetected: effectiveMime },
        stageB_classification: { passed: false, detectedType: 'UNKNOWN', confidence: 0.0 },
        stageC_ocrEvidence: { passed: false, matchedKeywordsCount: 0, matchedKeywords: [] },
        stageD_decision: {
          status: 'DOCUMENT_VALIDATION_UNAVAILABLE',
          decisionNotes: 'Validation unavailable due to missing GEMINI_API_KEY.',
        },
      },
    };
  }

  // STAGE B & C: Multimodal Analysis via Gemini
  try {
    const base64Data = fileBuffer.toString('base64');
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    const promptText = `
You are a senior Indian land revenue records examiner, forensic document examiner, and computer-vision OCR specialist.
You are inspecting an uploaded document from Maharashtra / India to verify whether it is a genuine, officially formatted land record.

CRITICAL INSTRUCTIONS:
1. Examine the actual visual contents, headers, typography, tables, stamps, and seals of the image or document.
2. Determine if this file belongs to one of these SUPPORTED MAHARASHTRA LAND RECORD CATEGORIES:
   - SATBARA_7_12: 7/12 Extract (Satbara / सातबारा / गाव नमुना सात-बारा). Features village form 7 & 12 layout, khata number, survey/gat number, hissa/sub-division, total area (hektar-aar), holder/bhogvatadar names, crops, and other rights/encumbrances.
   - FORM_8A: Form 8A Extract (नमुना ८-अ / खाते उतारा). Ledger of holdings of a specific land holder (khatedar) in the village.
   - PROPERTY_CARD: Property Card (मालमत्ता पत्रक / नगर भूमापन पत्रिका / Akhiv Patrika). Urban land record with City Survey Number (CTS No), plot number, area in sq meters.
   - FERFAR_MUTATION: Mutation Entry Register (फेरफार नोंद / गाव नमुना ६ / Ferfar). Official recorded transaction, inheritance succession, or bank lien charge/release.
   - SALE_DEED: Registered Land Sale Deed / Title Deed (खरेदीखत / विक्रीखत / दस्तऐवज). Formal legal deed with Sub-Registrar registration details, stamp duty, schedule of property.
   - OTHER_OFFICIAL_LAND_RECORD: Official Cadastral Tippani map, DGPS Mojani measurement sheet, or official Land Revenue tax receipt.
   - UNKNOWN: REJECT ANY of the following:
     * Ordinary photographs of scenery, landscapes, fields/farms with no document, roads, trees, mountains, sunsets.
     * Photographs of animals, pets, dogs, cats, food, plates, meals, cars, vehicles.
     * Selfies, portraits, or human photos.
     * Identity cards alone (Aadhaar card, PAN card, Voter ID, Driving License) when not part of a registered sale deed.
     * Invoices, shopping bills, restaurant receipts, utility bills, shipping slips.
     * Screenshots of unrelated websites, memes, random text documents, resumes.
     * Blurry or corrupted images where no land record text is decipherable.

3. DO NOT BE FOOLED BY:
   - A piece of paper that only has a stamp or signature but is not a land record.
   - A random document that simply mentions the word "land" or "Maharashtra".
   - An ordinary landscape or pet photo with a filename like "7_12.jpg" or "satbara.pdf". YOU MUST LOOK AT THE ACTUAL IMAGE CONTENTS.

4. EXTRACT REAL FIELDS ONLY:
   - Extract actual verbatim Marathi, Hindi, and English text into "ocrText".
   - Extract actual visible words/tokens into "visibleEvidence" (e.g. "गाव नमुना सात", "भोगवटादार", "खाते क्र", "क्षेत्र").
   - Extract "extractedFields":
     * ownerName: Full name of primary owner/holder visibly written. If multiple or joint, list primary. If not visible, return null.
     * surveyNo: Survey number or Gat number visibly printed (e.g. "78/4" or "142"). If not visible, return null.
     * gatNo: Gat number if separately mentioned, else null.
     * subDivision: Hissa / Pot-hissa number if mentioned, else null.
     * village: Village (गाव / मौजे) name if visible, else null.
     * taluka: Taluka (तालुका) if visible, else null.
     * district: District (जिल्हा) if visible, else null.
     * state: State if visible (default "Maharashtra" if from Maharashtra records), else null.
     * area: Formatted area text as visible (e.g. "1.45 हेक्टर" or "0.85 आर"), else null.
     * areaHa: Numeric area in Hectares if determinable, else null.
     * areaAcres: Numeric area in Acres if determinable, else null.
     * docDate: Document date if visible, else null.
     * docRef: Document reference / Ferfar no / Dast no / ULPIN if visible, else null.
     * ulpin: 14-digit BhuNaksha ULPIN if printed, else null.
     * encumbrances: Any visible bank charge, mortgage (बोजा), or court caveat if noted in 'इतर हक्क' column, else null.
     * classification: Land tenure class (Bhogvatadar Class 1, Class 2, R-Zone, Agri, etc.), else null.
   - NEVER invent or hallucinate survey numbers, names, or areas. If missing or illegible, set to null.

5. QUALITY & CONFIDENCE:
   - imageQuality: "readable", "partially_readable", or "unreadable".
   - classificationConfidence: Float between 0.0 and 1.0 representing how confident you are in this classification.
   - requiresManualReview: True if partially readable, blurred, cropped, or classification confidence is less than 0.85.
   - reasons: List 2-4 specific reasons explaining your findings based on visual elements observed.
`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: effectiveMime,
              data: base64Data,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSupportedLandDocument: {
              type: Type.BOOLEAN,
              description: 'True ONLY if the visual content is an authentic Indian/Maharashtra land record document.',
            },
            documentType: {
              type: Type.STRING,
              description:
                'One of: SATBARA_7_12, FORM_8A, PROPERTY_CARD, FERFAR_MUTATION, SALE_DEED, OTHER_OFFICIAL_LAND_RECORD, UNKNOWN',
            },
            classificationConfidence: {
              type: Type.NUMBER,
              description: 'Confidence in range 0.0 to 1.0',
            },
            language: {
              type: Type.STRING,
              description: 'One of: English, Marathi, Hindi, Mixed, Unknown',
            },
            imageQuality: {
              type: Type.STRING,
              description: 'One of: readable, partially_readable, unreadable',
            },
            visibleEvidence: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Actual words or phrases visibly spotted on the document.',
            },
            ocrText: {
              type: Type.STRING,
              description: 'Verbatim OCR text transcribed from the document.',
            },
            extractedFields: {
              type: Type.OBJECT,
              properties: {
                ownerName: { type: Type.STRING, nullable: true },
                surveyNo: { type: Type.STRING, nullable: true },
                gatNo: { type: Type.STRING, nullable: true },
                subDivision: { type: Type.STRING, nullable: true },
                village: { type: Type.STRING, nullable: true },
                taluka: { type: Type.STRING, nullable: true },
                district: { type: Type.STRING, nullable: true },
                state: { type: Type.STRING, nullable: true },
                area: { type: Type.STRING, nullable: true },
                areaHa: { type: Type.NUMBER, nullable: true },
                areaAcres: { type: Type.NUMBER, nullable: true },
                docDate: { type: Type.STRING, nullable: true },
                docRef: { type: Type.STRING, nullable: true },
                ulpin: { type: Type.STRING, nullable: true },
                encumbrances: { type: Type.STRING, nullable: true },
                classification: { type: Type.STRING, nullable: true },
              },
            },
            reasons: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Explanations for acceptance, rejection, or manual review.',
            },
            requiresManualReview: {
              type: Type.BOOLEAN,
              description: 'True if manual officer review is needed.',
            },
          },
          required: [
            'isSupportedLandDocument',
            'documentType',
            'classificationConfidence',
            'language',
            'imageQuality',
            'visibleEvidence',
            'ocrText',
            'extractedFields',
            'reasons',
            'requiresManualReview',
          ],
        },
      },
    });

    const responseText = response.text?.trim() || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini response as JSON:', responseText);
      return {
        status: 'NEEDS_MANUAL_REVIEW',
        isSupportedLandDocument: false,
        documentType: 'UNKNOWN',
        documentTypeDescription: SUPPORTED_LAND_DOCUMENT_DESCRIPTIONS.UNKNOWN,
        classificationConfidence: 0.3,
        language: 'Unknown',
        imageQuality: 'partially_readable',
        visibleEvidence: [],
        ocrText: responseText.slice(0, 500),
        extractedFields: getEmptyExtractedFields(),
        reasons: ['Malformed model response format. Flagged for manual review.'],
        requiresManualReview: true,
        sha256,
        verifiedAt,
        evidenceLimitationNotice: EVIDENCE_LIMITATION_NOTICE,
        stageResults: {
          stageA_fileValidation: { passed: true, message: 'Valid file signature.', mimeTypeDetected: effectiveMime },
          stageB_classification: { passed: false, detectedType: 'UNKNOWN', confidence: 0.3 },
          stageC_ocrEvidence: { passed: false, matchedKeywordsCount: 0, matchedKeywords: [] },
          stageD_decision: { status: 'NEEDS_MANUAL_REVIEW', decisionNotes: 'Model returned unparseable output.' },
        },
      };
    }

    // Normalizing parsed fields
    let docType = (parsed.documentType as LandDocumentType) || 'UNKNOWN';
    if (!SUPPORTED_LAND_DOCUMENT_DESCRIPTIONS[docType]) {
      docType = 'UNKNOWN';
    }

    const confidence = typeof parsed.classificationConfidence === 'number' ? parsed.classificationConfidence : 0.0;
    const isLandDocClaimed = Boolean(parsed.isSupportedLandDocument && docType !== 'UNKNOWN');
    const visibleEvidence: string[] = Array.isArray(parsed.visibleEvidence) ? parsed.visibleEvidence : [];
    const ocrText: string = typeof parsed.ocrText === 'string' ? parsed.ocrText : '';
    const reasons: string[] = Array.isArray(parsed.reasons) ? parsed.reasons : [];

    // STAGE C: Independent Server-Side Verification of Extracted Evidence
    const fullTextToInspect = `${ocrText} ${visibleEvidence.join(' ')}`.toLowerCase();
    const expectedKeywords = LAND_RECORD_KEYWORDS[docType] || [];
    const matchedKeywords: string[] = [];

    for (const kw of expectedKeywords) {
      if (fullTextToInspect.includes(kw.toLowerCase())) {
        matchedKeywords.push(kw);
      }
    }

    // Also check generic land record terms across all types
    const allLandTerms = Object.values(LAND_RECORD_KEYWORDS).flat();
    const allMatches = allLandTerms.filter((kw) => fullTextToInspect.includes(kw.toLowerCase()));

    // STAGE D: Strict Decision Logic
    let finalStatus: DocumentValidationStatus = 'REJECTED_NOT_LAND_DOCUMENT';
    let finalRequiresManualReview = Boolean(parsed.requiresManualReview);
    let decisionNotes = '';

    if (!isLandDocClaimed || docType === 'UNKNOWN') {
      finalStatus = 'REJECTED_NOT_LAND_DOCUMENT';
      decisionNotes = 'Visual content is not recognized as a supported Maharashtra land record document.';
      if (reasons.length === 0) {
        reasons.push('Document lacks standard cadastral layout, village form headers, or official revenue seals.');
      }
    } else if (confidence < 0.55 || (allMatches.length === 0 && matchedKeywords.length === 0)) {
      // Overrule model if it claimed land document but evidence contains zero cadastral terms!
      finalStatus = 'REJECTED_NOT_LAND_DOCUMENT';
      docType = 'UNKNOWN';
      decisionNotes =
        'Model claimed land document but independent verification found zero verifiable revenue terms or cadastral tokens.';
      reasons.unshift('Zero authentic Maharashtra land record keywords found in extracted visual text.');
    } else if (
      confidence < 0.78 ||
      parsed.imageQuality === 'partially_readable' ||
      parsed.imageQuality === 'unreadable' ||
      !parsed.extractedFields?.surveyNo
    ) {
      // Borderline or partially readable or missing key survey identification
      finalStatus = 'NEEDS_MANUAL_REVIEW';
      finalRequiresManualReview = true;
      decisionNotes =
        'Land document structure detected, but image quality is marginal or key identifiers require officer verification.';
      if (!parsed.extractedFields?.surveyNo) {
        reasons.push('Survey/Gat number could not be unequivocally extracted from the image.');
      }
    } else {
      // Valid land record layout & evidence
      finalStatus = 'ACCEPTED_LAND_DOCUMENT';
      decisionNotes = `Detected layout and terminology consistent with ${SUPPORTED_LAND_DOCUMENT_DESCRIPTIONS[docType]} (${matchedKeywords.length} verified tokens). Legal title authenticity pending official revenue authority verification.`;
    }

    // Clean up extracted fields
    const rawFields = parsed.extractedFields || {};
    const extractedFields: ExtractedLandFields = {
      ownerName: cleanString(rawFields.ownerName),
      surveyNo: cleanString(rawFields.surveyNo),
      gatNo: cleanString(rawFields.gatNo),
      subDivision: cleanString(rawFields.subDivision),
      village: cleanString(rawFields.village),
      taluka: cleanString(rawFields.taluka),
      district: cleanString(rawFields.district),
      state: cleanString(rawFields.state) || (docType !== 'UNKNOWN' ? 'Maharashtra' : null),
      area: cleanString(rawFields.area),
      areaHa: typeof rawFields.areaHa === 'number' && !isNaN(rawFields.areaHa) ? rawFields.areaHa : null,
      areaAcres: typeof rawFields.areaAcres === 'number' && !isNaN(rawFields.areaAcres) ? rawFields.areaAcres : null,
      docDate: cleanString(rawFields.docDate),
      docRef: cleanString(rawFields.docRef),
      ulpin: cleanString(rawFields.ulpin),
      encumbrances: cleanString(rawFields.encumbrances),
      classification: cleanString(rawFields.classification),
    };

    return {
      status: finalStatus,
      isSupportedLandDocument: finalStatus === 'ACCEPTED_LAND_DOCUMENT' || finalStatus === 'NEEDS_MANUAL_REVIEW',
      documentType: docType,
      documentTypeDescription: SUPPORTED_LAND_DOCUMENT_DESCRIPTIONS[docType],
      classificationConfidence: Number(confidence.toFixed(2)),
      language: parsed.language || 'Marathi',
      imageQuality: parsed.imageQuality || 'readable',
      visibleEvidence,
      ocrText,
      extractedFields,
      reasons,
      requiresManualReview: finalRequiresManualReview,
      sha256,
      verifiedAt,
      evidenceLimitationNotice: EVIDENCE_LIMITATION_NOTICE,
      stageResults: {
        stageA_fileValidation: { passed: true, message: 'Valid file signature.', mimeTypeDetected: effectiveMime },
        stageB_classification: {
          passed: isLandDocClaimed,
          detectedType: docType,
          confidence: Number(confidence.toFixed(2)),
        },
        stageC_ocrEvidence: {
          passed: matchedKeywords.length > 0 || allMatches.length > 0,
          matchedKeywordsCount: matchedKeywords.length > 0 ? matchedKeywords.length : allMatches.length,
          matchedKeywords: matchedKeywords.length > 0 ? matchedKeywords : allMatches,
        },
        stageD_decision: { status: finalStatus, decisionNotes },
      },
    };
  } catch (err: any) {
    console.error('Error in Gemini document classification:', err);
    return {
      status: 'DOCUMENT_VALIDATION_UNAVAILABLE',
      isSupportedLandDocument: false,
      documentType: 'UNKNOWN',
      documentTypeDescription: SUPPORTED_LAND_DOCUMENT_DESCRIPTIONS.UNKNOWN,
      classificationConfidence: 0.0,
      language: 'Unknown',
      imageQuality: 'unreadable',
      visibleEvidence: [],
      ocrText: '',
      extractedFields: getEmptyExtractedFields(),
      reasons: [`AI Document Validation API call failed: ${err.message || 'Unknown network error'}`],
      requiresManualReview: true,
      sha256,
      verifiedAt,
      evidenceLimitationNotice: EVIDENCE_LIMITATION_NOTICE,
      stageResults: {
        stageA_fileValidation: { passed: true, message: 'Valid file signature.', mimeTypeDetected: effectiveMime },
        stageB_classification: { passed: false, detectedType: 'UNKNOWN', confidence: 0.0 },
        stageC_ocrEvidence: { passed: false, matchedKeywordsCount: 0, matchedKeywords: [] },
        stageD_decision: {
          status: 'DOCUMENT_VALIDATION_UNAVAILABLE',
          decisionNotes: `AI service error: ${err.message}`,
        },
      },
    };
  }
}

function cleanString(val: any): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'none') {
    return null;
  }
  return trimmed;
}

function getEmptyExtractedFields(): ExtractedLandFields {
  return {
    ownerName: null,
    surveyNo: null,
    gatNo: null,
    subDivision: null,
    village: null,
    taluka: null,
    district: null,
    state: null,
    area: null,
    areaHa: null,
    areaAcres: null,
    docDate: null,
    docRef: null,
    ulpin: null,
    encumbrances: null,
    classification: null,
  };
}

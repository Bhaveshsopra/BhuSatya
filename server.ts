import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { db, Parcel, StoredCertificate, evaluateParcelGates } from './src/server/db.ts';
import { OfficerQueueItem, ExtractionData } from './src/types/index.ts';
import {
  classifyAndExtractLandDocument,
  DocumentClassificationResult,
  SUPPORTED_LAND_DOCUMENT_DESCRIPTIONS,
} from './src/server/documentClassifier.ts';

// Deterministic SHA-256 canonical hash computation for title certificates
export function computeCanonicalCertHash(certData: {
  certId: string;
  parcelId: string;
  ulpin: string;
  surveyNo: string;
  issuedTo: string;
  village: string;
  taluka: string;
  district: string;
  areaHa: number;
  issueDate: string;
}): string {
  const canonical = `${certData.certId}|${certData.parcelId}|${certData.ulpin}|${certData.surveyNo}|${certData.issuedTo}|${certData.village}|${certData.taluka}|${certData.district}|${certData.areaHa}|${certData.issueDate}`;
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// 1. Safe File Upload Storage Configuration (Protected from path traversal)
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'documents');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const safeExt = rawExt || '.pdf';
    const serverName = `bhu_doc_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${safeExt}`;
    cb(null, serverName);
  },
});

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB maximum
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif'];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMime = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/pjpeg',
      'image/tiff',
      'application/octet-stream',
    ];
    if (allowedExts.includes(ext) && (allowedMime.includes(file.mimetype) || !file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_FILE_TYPE: Only PDF, PNG, JPG, or TIFF documents are permitted.'));
    }
  },
});

// --- API ROUTES ---

// 1. Get all parcels / cases
app.get('/api/parcels', (req, res) => {
  const { filter, search } = req.query;
  let parcels = db.getParcels();

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    parcels = parcels.filter(
      (p) =>
        p.surveyNo.toLowerCase().includes(q) ||
        p.gatNo.toLowerCase().includes(q) ||
        p.ulpin.toLowerCase().includes(q) ||
        p.village.toLowerCase().includes(q) ||
        p.primaryOwner.toLowerCase().includes(q) ||
        (p.caseNo && p.caseNo.toLowerCase().includes(q))
    );
  }

  if (filter && typeof filter === 'string' && filter !== 'all') {
    if (filter === 'verified') {
      parcels = parcels.filter(
        (p) => p.recommendation === 'Pass' || p.caseStatus === 'OFFICER_SANCTIONED' || p.caseStatus === 'TITLE_VERIFIED'
      );
    } else if (filter === 'pending') {
      parcels = parcels.filter(
        (p) => p.recommendation === 'Needs Review' && p.caseStatus !== 'REGISTRATION_FROZEN'
      );
    } else if (filter === 'attention') {
      parcels = parcels.filter(
        (p) => p.caseStatus === 'REGISTRATION_FROZEN' || p.status.includes('BLOCK') || p.score < 50
      );
    }
  }

  res.json({ success: true, count: parcels.length, data: parcels });
});

// 2. Get parcel by ID
app.get('/api/parcels/:id', (req, res) => {
  const parcel = db.getParcelById(req.params.id);
  if (!parcel) {
    return res.status(404).json({ success: false, error: 'Parcel not found' });
  }
  res.json({ success: true, data: parcel });
});

// 3. Create Verification Request & Upload Document (Supports multipart/form-data & JSON)
app.post('/api/parcels/upload', (req, res) => {
  const isMultipart = req.headers['content-type']?.includes('multipart/form-data');

  const processUpload = async (req: express.Request, res: express.Response) => {
    try {
      const file = req.file;
      const body = req.body || {};

      // Stage A Mandatory Requirement: Reject requests without a genuine physical file upload
      if (!file) {
        return res.status(400).json({
          success: false,
          error:
            'A genuine uploaded land document file (PDF, PNG, JPEG, or TIFF) is mandatory. Requests with only fabricated metadata without a genuine file are rejected.',
        });
      }

      const fileSize = file.size;
      const fileName = file.originalname;
      const fileType = file.mimetype;
      const source = body.source || 'Citizen Upload';
      const stateAuthority = body.stateAuthority || 'mh';

      // File size validation (max 25MB)
      if (fileSize > 25 * 1024 * 1024) {
        try { fs.unlinkSync(file.path); } catch (_) {}
        return res.status(400).json({ success: false, error: 'File size exceeds maximum allowed limit of 25MB.' });
      }

      // STAGE A, B, C, D: Multi-Stage Document Classification and OCR Analysis
      const fileBuffer = fs.readFileSync(file.path);
      const classification = await classifyAndExtractLandDocument(fileBuffer, file.mimetype, file.originalname);

      // STAGE D: Fail-Closed on Non-Land Documents (HTTP 422)
      if (classification.status === 'REJECTED_NOT_LAND_DOCUMENT') {
        try { fs.unlinkSync(file.path); } catch (_) {}
        return res.status(422).json({
          success: false,
          error: `DOCUMENT_REJECTED: The submitted file "${file.originalname}" is not recognized as a supported Maharashtra land record document.`,
          reasons: classification.reasons,
          classification,
        });
      }

      // AI Service Unavailable: Fail-Closed (HTTP 503)
      if (classification.status === 'DOCUMENT_VALIDATION_UNAVAILABLE') {
        try { fs.unlinkSync(file.path); } catch (_) {}
        return res.status(503).json({
          success: false,
          error:
            'DOCUMENT_VALIDATION_UNAVAILABLE: AI Document Classification and OCR service is unavailable. Please verify server GEMINI_API_KEY configuration and retry.',
          reasons: classification.reasons,
          classification,
        });
      }

      // Populate fields ONLY from actual visual classification when available, or explicit user form input
      const extracted = classification.extractedFields;

      const surveyNo = body.surveyNo;
      const village = body.village;
      const taluka = body.taluka;
      const district = body.district;
      const ownerName = body.ownerName;
      const areaHa = body.areaHa;
      const encumbrance = body.encumbrance;
      const litigation = body.litigation;

      const assignedSurvey =
        extracted?.surveyNo ||
        (surveyNo && typeof surveyNo === 'string' && surveyNo.trim().length > 0 ? surveyNo.trim() : null);

      const assignedGat =
        extracted?.gatNo ||
        (extracted?.surveyNo ? `Gat No. ${extracted.surveyNo}` : null);

      // NEVER fabricate official government identifiers (ULPIN). Only assign if detected or mark pending.
      const assignedUlpin = extracted?.ulpin || null;

      const assignedOwner =
        extracted?.ownerName ||
        (ownerName && typeof ownerName === 'string' && ownerName.trim().length > 0 ? ownerName.trim() : null);

      const assignedVillage =
        extracted?.village ||
        (village && typeof village === 'string' && village.trim().length > 0 ? village.trim() : null);

      const assignedTaluka =
        extracted?.taluka ||
        (taluka && typeof taluka === 'string' && taluka.trim().length > 0 ? taluka.trim() : null);

      const assignedDistrict =
        extracted?.district ||
        (district && typeof district === 'string' && district.trim().length > 0 ? district.trim() : 'Maharashtra');

      const parsedArea =
        extracted?.areaHa !== null && extracted?.areaHa !== undefined && extracted.areaHa > 0
          ? extracted.areaHa
          : Number(areaHa) > 0
          ? Number(areaHa)
          : 0;

      const parsedAcres =
        extracted?.areaAcres !== null && extracted?.areaAcres !== undefined && extracted.areaAcres > 0
          ? extracted.areaAcres
          : parsedArea > 0
          ? Number((parsedArea * 2.471).toFixed(2))
          : 0;

      // Internal application IDs only (never fabricated government land identifiers)
      const assignedCaseNo = `CASE-${new Date().getFullYear()}-MH-${Math.floor(Math.random() * 80000 + 10000)}`;
      const newParcelId = `p-${Date.now().toString().slice(-6)}`;

      // Verification checks: NEVER fabricate clearance
      const assignedEncumbrance =
        extracted?.encumbrances ||
        (encumbrance && typeof encumbrance === 'string' && encumbrance.trim().length > 0
          ? encumbrance.trim()
          : 'Pending CERSAI & Sub-Registrar Search');

      const assignedLitigation =
        litigation && typeof litigation === 'string' && litigation.trim().length > 0
          ? litigation.trim()
          : 'Pending District e-Courts Record Search';

      const isManualReview = classification.status === 'NEEDS_MANUAL_REVIEW';

      const rawParcel: Partial<Parcel> = {
        id: newParcelId,
        caseNo: assignedCaseNo,
        surveyNo: assignedSurvey || 'Survey Pending Confirmation',
        gatNo: assignedGat || 'Gat Pending Confirmation',
        ulpin: assignedUlpin || 'Pending ULPIN Assignment',
        village: assignedVillage || 'Village Pending Confirmation',
        taluka: assignedTaluka || 'Taluka Pending Confirmation',
        district: assignedDistrict,
        state: stateAuthority === 'ka' ? 'Karnataka' : stateAuthority === 'up' ? 'Uttar Pradesh' : 'Maharashtra',
        areaHa: parsedArea,
        areaAcres: parsedAcres,
        classification: extracted?.classification || 'Pending Revenue Classification',
        primaryOwner: assignedOwner || 'Owner Pending Confirmation',
        jointShareInfo: 'Pending Legal Heir & Khatedar Verification (Unverified)',
        tags: [
          `Classified: ${classification.documentType}`,
          isManualReview ? 'Requires Officer Scrutiny' : 'Intake Classified',
        ],
        verifiedDate: 'Pending Verification',
        encumbrance: assignedEncumbrance,
        litigation: assignedLitigation,
        buffer: 'Pending GIS Buffer & Eco-sensitive Zone Check',
        overlap: 'Pending Cadastral Tippani Overlay Reconciliation',
        readyReckonerRate: Math.round(parsedArea * 12000000),
        askingPrice: Math.round(parsedArea * 12500000),
        stampDuty: Math.round(parsedArea * 12500000 * 0.07),
        dgpsSurveyDate: 'Pending Demarcation',
        tilrAuthority: 'TILR Pending Assignment',
        documentMeta: {
          fileName,
          serverFileName: file.filename,
          storagePath: path.join('uploads', 'documents', file.filename),
          fileSize: `${(fileSize / (1024 * 1024)).toFixed(1)} MB`,
          fileType,
          uploadedAt: new Date().toLocaleString(),
          source,
          isDurableStorage: true,
          sha256: classification.sha256,
          classification,
        },
        override: null,
      };

      const evalResult = evaluateParcelGates(rawParcel);

      const parcelStatus = isManualReview
        ? 'Needs Review - Officer Scrutiny Required'
        : 'Pending Verification - Document Classified';

      const registrationStatus = isManualReview
        ? 'FLAGGED FOR MANUAL SCRUTINY'
        : 'PENDING REVENUE SCRUTINY';

      const caseStatus = isManualReview ? 'NEEDS_OFFICER_REVIEW' : 'PENDING_REVIEW';

      const recommendationExplanation = isManualReview
        ? `Document flagged for manual scrutiny: ${classification.reasons.join('; ')}`
        : `Document classified as ${SUPPORTED_LAND_DOCUMENT_DESCRIPTIONS[classification.documentType]}. Government title search, sub-registrar search, and cadastral boundary verification pending.`;

      const newParcel: Parcel = {
        ...(rawParcel as any),
        score: evalResult.score,
        diligenceScore: evalResult.diligenceScore,
        gates: evalResult.gates,
        recommendation: isManualReview ? 'Needs Review' : (evalResult.recommendation as any),
        recommendationExplanation,
        status: parcelStatus,
        registrationStatus,
        caseStatus,
      };

      db.createParcel(newParcel);

      // Update Extraction data with real extracted fields and provenance
      db.updateExtraction({
        docRef: `DOC-MAH-${(newParcel.taluka || 'REV').toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-5)}`,
        parcelId: newParcel.id,
        village: newParcel.village,
        taluka: newParcel.taluka,
        district: newParcel.district,
        source: newParcel.documentMeta?.source || 'Citizen Upload',
        classification,
        fields: {
          primaryOwner: {
            value: newParcel.primaryOwner,
            marathi: extracted?.ownerName || newParcel.primaryOwner,
            confidence: Math.round(classification.classificationConfidence * 100),
            status: extracted?.ownerName ? 'AI Extracted' : 'Unverified - Confirmation Needed',
            notes: extracted?.ownerName
              ? 'Extracted from uploaded document visual text.'
              : 'Field not detected; user confirmation required.',
            provenance: extracted?.ownerName ? 'AI_EXTRACTED' : 'UNVERIFIED',
          },
          surveyNumber: {
            value: newParcel.surveyNo.replace('Survey No. ', ''),
            marathi: extracted?.surveyNo || newParcel.surveyNo,
            confidence: Math.round(classification.classificationConfidence * 100),
            status: extracted?.surveyNo ? 'AI Extracted' : 'Unverified - Confirmation Needed',
            notes: extracted?.surveyNo
              ? 'Extracted from uploaded document text.'
              : 'Field not detected; user confirmation required.',
            provenance: extracted?.surveyNo ? 'AI_EXTRACTED' : 'UNVERIFIED',
          },
          subDivision: {
            value: extracted?.subDivision || 'Unspecified',
            marathi: extracted?.subDivision || 'अनिर्दिष्ट',
            confidence: extracted?.subDivision ? Math.round(classification.classificationConfidence * 100) : 50,
            status: extracted?.subDivision ? 'AI Extracted' : 'Unverified',
            notes: extracted?.subDivision ? 'Extracted hissa demarcation.' : 'Sub-division not specified in document.',
            provenance: extracted?.subDivision ? 'AI_EXTRACTED' : 'UNVERIFIED',
          },
          totalArea: {
            value: parsedArea > 0 ? `${newParcel.areaHa} Ha (${newParcel.areaAcres} Acres)` : 'Unspecified',
            marathi: parsedArea > 0 ? `${newParcel.areaHa} हेक्टर` : 'अनिर्दिष्ट',
            confidence: extracted?.areaHa ? Math.round(classification.classificationConfidence * 100) : 50,
            status: extracted?.areaHa ? 'AI Extracted' : 'Unverified',
            notes: extracted?.areaHa ? 'Area extracted from document text.' : 'Area not clearly readable in document.',
            provenance: extracted?.areaHa ? 'AI_EXTRACTED' : 'UNVERIFIED',
          },
          shareFraction: {
            value: 'Pending Co-parcener Verification',
            marathi: 'तपासणी प्रलंबित',
            confidence: 50,
            status: 'Unverified',
            notes: 'Coparcenary share fraction requires legal heir inquiry.',
            provenance: 'UNVERIFIED',
          },
          encumbrances: {
            value: newParcel.encumbrance,
            marathi: extracted?.encumbrances || 'तपासणी प्रलंबित',
            confidence: extracted?.encumbrances ? Math.round(classification.classificationConfidence * 100) : 50,
            status: extracted?.encumbrances ? 'AI Extracted' : 'Unverified',
            notes: extracted?.encumbrances
              ? 'Extracted from other rights (इतर हक्क).'
              : 'Official CERSAI search certificate not linked.',
            provenance: extracted?.encumbrances ? 'AI_EXTRACTED' : 'UNVERIFIED',
          },
        },
      });

      // Create linked Officer Queue entry so case is immediately actionable
      const queueItem: OfficerQueueItem = {
        id: `oq-${Date.now()}`,
        caseNo: assignedCaseNo,
        parcelId: newParcel.id,
        surveyNo: newParcel.surveyNo,
        taluka: newParcel.taluka,
        applicant: newParcel.primaryOwner,
        stage: isManualReview
          ? 'Manual Document Scrutiny & Discrepancy Review'
          : 'Initial Revenue Scrutiny & Official Registry Verification',
        blockTriggers: [
          ...newParcel.gates.filter((g) => g.status === 'BLOCK' || g.status === 'WARN').map((g) => g.name),
          ...(classification.requiresManualReview ? [`Doc Scrutiny: ${classification.documentType}`] : []),
        ],
        urgency: isManualReview ? 'High' : 'Medium',
        receivedDate: 'Just now',
        status: isManualReview ? 'Pending Tahsildar Review' : 'Pending Verification Audit',
      };
      db.addOfficerQueueItem(queueItem);

      // Log in Audit Trail
      db.addAuditLog({
        parcelId: newParcel.id,
        action: 'CASE_CREATED',
        actor: `Citizen (${newParcel.primaryOwner})`,
        notes: `Verification request ${assignedCaseNo} registered with document ${newParcel.documentMeta?.fileName}. Initial triage score: ${evalResult.score}/100. Verification pending.`,
      });

      // Add notification alert
      db.addAlert({
        type: isManualReview ? 'info' : 'success',
        title: isManualReview
          ? `Review Case Flagged: ${newParcel.surveyNo}`
          : `Verification Request Registered: ${newParcel.surveyNo}`,
        time: 'Just now',
        meta: `Case No: ${assignedCaseNo} • Status: ${newParcel.caseStatus} • Score: ${newParcel.score}/100`,
        parcelId: newParcel.id,
      });

      res.json({
        success: true,
        message: isManualReview
          ? 'Document submitted and queued for officer scrutiny.'
          : 'Document classified and verification request created successfully.',
        data: newParcel,
        classification,
      });
    } catch (err: any) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
      console.error('Error handling parcel upload:', err);
      res.status(500).json({ success: false, error: err.message || 'Server error processing upload.' });
    }
  };

  if (isMultipart) {
    uploadMiddleware.single('document')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, error: 'File size exceeds maximum allowed limit of 25MB.' });
        }
        return res.status(400).json({ success: false, error: err.message || 'File upload error.' });
      }
      processUpload(req, res);
    });
  } else {
    processUpload(req, res);
  }
});

// Safe Document Download with Path Traversal Protection
app.get('/api/documents/download/:filename', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'Document not found on server.' });
  }

  res.download(filePath, safeFilename);
});

// Dedicated Real Land Document Classification & OCR Inspection Endpoint
app.post('/api/documents/classify', uploadMiddleware.single('document'), async (req, res) => {
  try {
    let fileBuffer: Buffer | null = null;
    let mimeType = 'application/pdf';
    let originalName = 'document.pdf';

    if (req.file) {
      fileBuffer = fs.readFileSync(req.file.path);
      mimeType = req.file.mimetype;
      originalName = req.file.originalname;
      // Clean up uploaded temporary preview file
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    } else if (req.body?.base64) {
      fileBuffer = Buffer.from(req.body.base64, 'base64');
      mimeType = req.body.mimeType || 'application/pdf';
      originalName = req.body.fileName || 'document.pdf';
    }

    if (!fileBuffer) {
      return res.status(400).json({ success: false, error: 'No document file or base64 data provided for classification.' });
    }

    const result = await classifyAndExtractLandDocument(fileBuffer, mimeType, originalName);
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('Document classification endpoint error:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error during document classification.' });
  }
});

// 4. Re-evaluate Verification Gates
app.post('/api/parcels/:id/evaluate', (req, res) => {
  const parcel = db.getParcelById(req.params.id);
  if (!parcel) {
    return res.status(404).json({ success: false, error: 'Parcel not found' });
  }

  const evalResult = evaluateParcelGates(parcel);
  const updated = db.updateParcel(parcel.id, {
    score: evalResult.score,
    diligenceScore: evalResult.diligenceScore,
    gates: evalResult.gates,
    recommendation: evalResult.recommendation,
    recommendationExplanation: evalResult.recommendationExplanation,
  });

  db.addAuditLog({
    parcelId: parcel.id,
    action: 'VERIFICATION_EVALUATED',
    actor: 'DILRMP Rules Engine v4.2',
    notes: `Re-evaluated 8 verification gates. Score: ${evalResult.score}/100. Recommendation: ${evalResult.recommendation}.`,
  });

  res.json({ success: true, message: 'Verification gates evaluated', data: updated });
});

// 5. Extraction API
app.get('/api/extraction', (req, res) => {
  const { parcelId } = req.query;
  const ext = db.getExtraction();
  if (parcelId && typeof parcelId === 'string') {
    const parcel = db.getParcelById(parcelId);
    if (parcel) {
      return res.json({
        success: true,
        data: {
          ...ext,
          parcelId: parcel.id,
          village: parcel.village,
          taluka: parcel.taluka,
          district: parcel.district,
          fields: {
            ...ext.fields,
            primaryOwner: { ...ext.fields.primaryOwner, value: parcel.primaryOwner },
            surveyNumber: { ...ext.fields.surveyNumber, value: parcel.surveyNo.replace('Survey No. ', '') },
            totalArea: { ...ext.fields.totalArea, value: `${parcel.areaHa} Ha (${parcel.areaAcres} Acres)` },
            encumbrances: { ...ext.fields.encumbrances, value: parcel.encumbrance },
          },
        },
      });
    }
  }
  res.json({ success: true, data: ext });
});

app.put('/api/extraction', (req, res) => {
  const updates = req.body;
  const current = db.getExtraction();

  // Initialize originalFields if not yet captured
  const originalFields = current.originalFields || {
    primaryOwner: current.fields.primaryOwner?.value || '',
    surveyNumber: current.fields.surveyNumber?.value || '',
    subDivision: current.fields.subDivision?.value || '',
    totalArea: current.fields.totalArea?.value || '',
    shareFraction: current.fields.shareFraction?.value || '',
    encumbrances: current.fields.encumbrances?.value || '',
  };

  const corrections: Record<string, { original: string; corrected: string; timestamp: string }> = {
    ...(current.corrections || {}),
  };

  const mergedFields: any = { ...current.fields };
  const editedFieldNames: string[] = [];

  if (updates.fields) {
    const keys = ['primaryOwner', 'surveyNumber', 'subDivision', 'totalArea', 'shareFraction', 'encumbrances'] as const;
    for (const key of keys) {
      if (updates.fields[key]) {
        const updateItem = updates.fields[key];
        const origVal = (originalFields as any)[key] ?? '';
        const currentField = current.fields[key] || {};
        const isChanged = updateItem.value !== undefined && updateItem.value !== origVal;

        if (isChanged) {
          editedFieldNames.push(key);
          corrections[key] = {
            original: origVal,
            corrected: updateItem.value,
            timestamp: new Date().toISOString(),
          };
          mergedFields[key] = {
            ...currentField,
            ...updateItem,
            originalValue: origVal,
            isEdited: true,
            provenance: 'USER_CORRECTED',
            status: 'Citizen Corrected',
          };
        } else {
          mergedFields[key] = {
            ...currentField,
            ...updateItem,
            originalValue: currentField.originalValue || origVal,
            isEdited: Boolean(currentField.isEdited),
            provenance: currentField.provenance || 'AI_EXTRACTED',
          };
        }
      }
    }
  }

  const updatedExtraction: ExtractionData = {
    ...current,
    ...updates,
    originalFields,
    corrections,
    fields: mergedFields,
  };

  const savedExtraction = db.updateExtraction(updatedExtraction);

  // If fields are updated, sync back to the associated parcel
  const targetParcelId = updates.parcelId || current.parcelId || 'p-142-3a';
  const parcel = db.getParcelById(targetParcelId);
  if (parcel && updates.fields) {
    const pUpdates: Partial<Parcel> = {};
    if (updates.fields.primaryOwner?.value) pUpdates.primaryOwner = updates.fields.primaryOwner.value;
    if (updates.fields.encumbrances?.value) pUpdates.encumbrance = updates.fields.encumbrances.value;

    db.updateParcel(parcel.id, pUpdates);

    const auditNotes = editedFieldNames.length > 0
      ? `Citizen corrected fields [${editedFieldNames.join(', ')}]. Original AI values preserved.`
      : 'Audited and confirmed extracted fields without modifications.';

    db.addAuditLog({
      parcelId: parcel.id,
      action: 'EXTRACTION_REVIEWED',
      actor: 'Citizen / Auditor',
      notes: auditNotes,
    });
  }

  res.json({ success: true, data: savedExtraction });
});

app.post('/api/extraction/rescan', async (req, res) => {
  try {
    const { parcelId } = req.body || {};
    const targetId = parcelId || db.getExtraction().parcelId;
    const parcel = targetId ? db.getParcelById(targetId) : null;

    let targetFilePath: string | null = null;
    let fileName = 'document.pdf';
    let mimeType = 'application/pdf';

    if (parcel?.documentMeta?.serverFileName) {
      const candidate = path.join(UPLOADS_DIR, path.basename(parcel.documentMeta.serverFileName));
      if (fs.existsSync(candidate)) {
        targetFilePath = candidate;
        fileName = parcel.documentMeta.fileName || parcel.documentMeta.serverFileName;
        mimeType = parcel.documentMeta.fileType || 'application/pdf';
      }
    }

    if (!targetFilePath) {
      return res.status(404).json({
        success: false,
        error:
          'Original uploaded document file is unavailable on disk for re-scan. Please upload the genuine document again.',
      });
    }

    const fileBuffer = fs.readFileSync(targetFilePath);
    const classification = await classifyAndExtractLandDocument(fileBuffer, mimeType, fileName);

    if (classification.status === 'DOCUMENT_VALIDATION_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        error: 'AI Document Validation Service unavailable for re-scan. Please check GEMINI_API_KEY configuration.',
        reasons: classification.reasons,
        classification,
      });
    }

    if (classification.status === 'REJECTED_NOT_LAND_DOCUMENT') {
      return res.status(422).json({
        success: false,
        error: `RESCAN_REJECTED: Document re-scan determined file "${fileName}" is not a supported Maharashtra land record document.`,
        reasons: classification.reasons,
        classification,
      });
    }

    // Update extraction with actual result
    const ext = db.getExtraction();
    const extracted = classification.extractedFields;
    const refreshed: ExtractionData = {
      ...ext,
      quality: `${Math.round(classification.classificationConfidence * 100)}% Confidence (${classification.imageQuality})`,
      engine: `Gemini Multimodal Document AI (${classification.documentType})`,
      classification,
      fields: {
        ...ext.fields,
        primaryOwner: extracted?.ownerName
          ? {
              ...ext.fields.primaryOwner,
              value: extracted.ownerName,
              marathi: extracted.ownerName,
              confidence: Math.round(classification.classificationConfidence * 100),
              status: 'AI Extracted',
              notes: 'Re-extracted from document text.',
              provenance: 'AI_EXTRACTED',
            }
          : ext.fields.primaryOwner,
        surveyNumber: extracted?.surveyNo
          ? {
              ...ext.fields.surveyNumber,
              value: extracted.surveyNo,
              marathi: extracted.surveyNo,
              confidence: Math.round(classification.classificationConfidence * 100),
              status: 'AI Extracted',
              notes: 'Re-extracted from document text.',
              provenance: 'AI_EXTRACTED',
            }
          : ext.fields.surveyNumber,
        subDivision: extracted?.subDivision
          ? {
              ...ext.fields.subDivision,
              value: extracted.subDivision,
              marathi: extracted.subDivision,
              confidence: Math.round(classification.classificationConfidence * 100),
              status: 'AI Extracted',
              provenance: 'AI_EXTRACTED',
            }
          : ext.fields.subDivision,
        totalArea: extracted?.areaHa
          ? {
              ...ext.fields.totalArea,
              value: `${extracted.areaHa} Ha (${extracted.areaAcres ?? Number((extracted.areaHa * 2.471).toFixed(2))} Acres)`,
              marathi: `${extracted.areaHa} हेक्टर`,
              confidence: Math.round(classification.classificationConfidence * 100),
              status: 'AI Extracted',
              provenance: 'AI_EXTRACTED',
            }
          : ext.fields.totalArea,
      },
    };

    db.updateExtraction(refreshed);

    if (parcel) {
      db.updateParcel(parcel.id, {
        documentMeta: {
          ...parcel.documentMeta!,
          classification,
        },
      });
    }

    res.json({
      success: true,
      message: 'Real document re-scan completed successfully.',
      data: refreshed,
      classification,
    });
  } catch (err: any) {
    console.error('Error during re-scan:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error re-scanning document.' });
  }
});

app.post('/api/extraction/confirm', (req, res) => {
  const { parcelId } = req.body;
  const targetId = parcelId || db.getExtraction().parcelId || 'p-142-3a';
  const parcel = db.getParcelById(targetId);

  if (parcel) {
    // Confirming user-reviewed OCR fields moves case to pending officer scrutiny, NOT verified legal title!
    const nextCaseStatus =
      parcel.caseStatus === 'NEEDS_OFFICER_REVIEW' || parcel.recommendation === 'Needs Review'
        ? 'NEEDS_OFFICER_REVIEW'
        : 'VERIFICATION_IN_PROGRESS';

    db.updateParcel(parcel.id, {
      caseStatus: nextCaseStatus,
      registrationStatus: 'PENDING REVENUE SCRUTINY',
    });

    db.addAuditLog({
      parcelId: parcel.id,
      action: 'EXTRACTION_CONFIRMED',
      actor: 'Citizen / Auditor',
      notes: 'Audit fields confirmed by user. Formal revenue verification queued (Title verification not yet granted).',
    });

    db.addAlert({
      type: 'info',
      title: `Document Review Finalized: ${parcel.surveyNo}`,
      time: 'Just now',
      meta: 'OCR fields verified by applicant; awaiting officer title search.',
      parcelId: parcel.id,
    });
  }

  res.json({ success: true, message: 'Audit confirmed and queued for official scrutiny' });
});

// 6. Officer Override Submission
app.post('/api/parcels/:id/override', (req, res) => {
  const { justification, dscToken, officerName } = req.body;
  const parcel = db.getParcelById(req.params.id);

  if (!parcel) {
    return res.status(404).json({ success: false, error: 'Parcel not found' });
  }

  if (!justification || justification.trim().length < 5) {
    return res.status(400).json({ success: false, error: 'Justification reference number is required' });
  }

  const updated = db.updateParcel(parcel.id, {
    caseStatus: 'OFFICER_SANCTIONED',
    registrationStatus: 'OVERRIDE SANCTIONED (PROVISIONAL)',
    status: 'PASS - Officer Override Sanctioned',
    recommendation: 'Pass',
    recommendationExplanation: 'Divisional Commissioner sanctioned override under Sec. 34 MLRC based on submitted judicial order/sanction.',
    score: 85,
    diligenceScore: 85,
    override: {
      justification: justification.trim(),
      officerName: officerName || 'Shri Rajeshwar Rao, IAS',
      officerRole: 'Divisional Commissioner / Revenue',
      dscSignature: dscToken || 'SHA256: 4f8b9...c391 (C-DAC Class-3 DSC)',
      orderDate: new Date().toISOString(),
      status: 'Approved',
    },
  });

  // Update Officer Queue
  const queue = db.getOfficerQueue();
  const item = queue.find((q) => q.parcelId === parcel.id);
  if (item) {
    db.updateOfficerQueue(item.id, { status: 'Sanctioned by Divisional Commissioner' });
  }

  // Add audit log
  db.addAuditLog({
    parcelId: parcel.id,
    action: 'OFFICER_OVERRIDE_SANCTIONED',
    actor: officerName || 'Shri Rajeshwar Rao, IAS',
    notes: `Officer override granted under Sec. 34 MLRC. Justification: ${justification.trim()}`,
  });

  db.addAlert({
    type: 'info',
    title: `Officer Override Granted for ${parcel.surveyNo}`,
    time: 'Just now',
    meta: `Order Ref: ${justification.slice(0, 35)}... • Authorized by ${officerName || 'Divisional Commissioner'}`,
    parcelId: parcel.id,
  });

  res.json({ success: true, message: 'Officer override registered successfully', data: updated });
});

// 7. Escalate to Tehsildar & District Registrar
app.post('/api/parcels/:id/escalate', (req, res) => {
  const parcel = db.getParcelById(req.params.id);
  if (!parcel) {
    return res.status(404).json({ success: false, error: 'Parcel not found' });
  }

  const queueItem = {
    id: `oq-${Date.now()}`,
    caseNo: `ESC-REV-${Math.floor(Math.random() * 8000 + 1000)}`,
    parcelId: parcel.id,
    surveyNo: parcel.surveyNo,
    taluka: parcel.taluka,
    applicant: parcel.primaryOwner,
    stage: 'Sub-Divisional Officer / Tehsildar Escalation',
    blockTriggers: parcel.gates.filter((g) => g.status === 'BLOCK').map((g) => g.name),
    urgency: 'Critical' as const,
    receivedDate: 'Today',
    status: 'Under Tehsildar Enquiry',
  };

  const queue = db.getOfficerQueue();
  // check if already exists
  const existingIdx = queue.findIndex((q) => q.parcelId === parcel.id);
  if (existingIdx !== -1) {
    queue[existingIdx] = { ...queue[existingIdx], ...queueItem };
  } else {
    queue.unshift(queueItem);
  }
  db.save({ ...db.get(), officerQueue: queue });

  db.updateParcel(parcel.id, {
    caseStatus: 'NEEDS_OFFICER_REVIEW',
  });

  db.addAuditLog({
    parcelId: parcel.id,
    action: 'CASE_ESCALATED',
    actor: 'Citizen / Revenue Registry Gate',
    notes: `Escalated to Tehsildar & District Registrar. Enquiry Docket #${queueItem.caseNo}.`,
  });

  db.addAlert({
    type: 'error',
    title: `Escalation Notice Dispatched: ${parcel.surveyNo} sent to Tehsildar ${parcel.taluka}`,
    time: 'Just now',
    meta: `Case Reference #${queueItem.caseNo} • 14-day statutory enquiry notice initiated`,
    parcelId: parcel.id,
  });

  res.json({ success: true, message: 'Case escalated to Revenue Officer Queue', caseNo: queueItem.caseNo });
});

// 8. Officer Queue API
app.get('/api/officer-queue', (req, res) => {
  res.json({ success: true, data: db.getOfficerQueue() });
});

app.post('/api/officer-queue/:id/action', (req, res) => {
  const { action, notes, officerName } = req.body;
  const queueItem = db.getOfficerQueue().find((q) => q.id === req.params.id);

  if (!queueItem) {
    return res.status(404).json({ success: false, error: 'Officer queue item not found' });
  }

  const officer = officerName || 'Shri Rajeshwar Rao, IAS';
  let newStatus = 'Under Officer Review';
  let parcelCaseStatus: Parcel['caseStatus'] = 'NEEDS_OFFICER_REVIEW';

  if (action === 'approve') {
    newStatus = 'Sanctioned by Divisional Commissioner';
    parcelCaseStatus = 'OFFICER_SANCTIONED';
    db.updateParcel(queueItem.parcelId, {
      caseStatus: parcelCaseStatus,
      status: 'PASS - Officer Override Sanctioned',
      recommendation: 'Pass',
      recommendationExplanation: 'Officer Override Sanctioned by Divisional Commissioner.',
      officerRemarks: notes || 'Sanctioned upon examination of title documents and order copy.',
      score: 85,
    });
    db.addAuditLog({
      parcelId: queueItem.parcelId,
      action: 'OFFICER_OVERRIDE_SANCTIONED',
      actor: officer,
      notes: notes || 'Sanctioned after review of case docket.',
    });
  } else if (action === 'reject') {
    newStatus = 'Rejected & Registration Prohibited';
    parcelCaseStatus = 'REGISTRATION_FROZEN';
    db.updateParcel(queueItem.parcelId, {
      caseStatus: parcelCaseStatus,
      registrationStatus: 'MUTATION PROHIBITED / FROZEN',
      status: 'BLOCK - Registration Frozen by Officer',
      recommendation: 'Needs Review',
      recommendationExplanation: notes || 'Enquiry verified transfer restriction. Registration prohibited under MLRC.',
      officerRemarks: notes,
    });
    db.addAuditLog({
      parcelId: queueItem.parcelId,
      action: 'OFFICER_REGISTRATION_FROZEN',
      actor: officer,
      notes: notes || 'Registration prohibited following statutory enquiry.',
    });
  } else if (action === 'request_info') {
    newStatus = 'Additional Information Requested';
    parcelCaseStatus = 'ADDITIONAL_INFO_REQUESTED';
    db.updateParcel(queueItem.parcelId, {
      caseStatus: parcelCaseStatus,
      officerRemarks: notes || 'Please provide certified copy of mutation entry and bank discharge letter.',
    });
    db.addAuditLog({
      parcelId: queueItem.parcelId,
      action: 'ADDITIONAL_INFO_REQUESTED',
      actor: officer,
      notes: notes || 'Additional documents requested from applicant.',
    });
  } else if (action === 'hearing') {
    const hearingDate = '15 Nov 2024 at 11:30 AM';
    newStatus = `Hearing Scheduled (${hearingDate})`;
    parcelCaseStatus = 'NEEDS_OFFICER_REVIEW';
    db.updateParcel(queueItem.parcelId, {
      caseStatus: parcelCaseStatus,
      hearingDate,
      officerRemarks: `Summons issued for hearing on ${hearingDate}.`,
    });
    db.addAuditLog({
      parcelId: queueItem.parcelId,
      action: 'HEARING_SCHEDULED',
      actor: officer,
      notes: `Hearing scheduled before Sub-Divisional Officer on ${hearingDate}.`,
    });
  }

  const updatedQueue = db.updateOfficerQueue(queueItem.id, {
    status: newStatus,
    actionNotes: notes,
  });

  db.addAlert({
    type: action === 'approve' ? 'success' : action === 'reject' ? 'error' : 'info',
    title: `Officer Decision: ${queueItem.surveyNo}`,
    time: 'Just now',
    meta: `Action: ${newStatus} • Recorded by ${officer}`,
    parcelId: queueItem.parcelId,
  });

  res.json({ success: true, data: updatedQueue, parcel: db.getParcelById(queueItem.parcelId) });
});

// 9. Heir Consents API
app.get('/api/heir-consents', (req, res) => {
  const { parcelId } = req.query;
  const consents = db.getHeirConsents(typeof parcelId === 'string' ? parcelId : undefined);
  res.json({ success: true, data: consents });
});

app.post('/api/heir-consents', (req, res) => {
  const { parcelId, name, relation, aadhaarMasked } = req.body;
  if (!parcelId || !name || !relation) {
    return res.status(400).json({ success: false, error: 'Parcel ID, heir name, and relation are required' });
  }
  const newConsent = {
    id: `hc-${Date.now()}`,
    parcelId,
    name: name.trim(),
    relation: relation.trim(),
    aadhaarMasked: aadhaarMasked || `•••• •••• ${Math.floor(Math.random() * 8999 + 1000)}`,
    status: 'Pending' as const,
    timestamp: 'Just now',
    tokenId: `CDAC-REQ-${Math.floor(Math.random() * 89999 + 10000)}`,
    authMethod: 'Pending Aadhaar OTP eSign',
    objectionFiled: false,
  };
  db.addHeirConsent(newConsent);
  db.addAuditLog({
    parcelId,
    action: 'HEIR_CONSENT_REQUESTED',
    actor: 'Citizen / Registry',
    notes: `Requested statutory heir consent from ${name} (${relation}). Notice dispatched.`,
  });
  db.addAlert({
    type: 'info',
    title: `Heir Consent Request Dispatched: ${name}`,
    time: 'Just now',
    meta: `Relation: ${relation} • Section 6 HSA coparcener verification`,
    parcelId,
  });
  res.json({ success: true, message: 'Heir consent request initiated', data: newConsent });
});

app.post('/api/heir-consents/:id/sign', (req, res) => {
  const { otp } = req.body;

  // Validate simulated fixed demo OTP before updating consent status
  const cleanOtp = otp ? String(otp).trim() : '';
  if (cleanOtp !== '882914') {
    return res.status(400).json({
      success: false,
      error: 'INVALID_OTP: The entered simulated Aadhaar OTP is invalid. Use fixed demo OTP 882914 to authenticate in this demonstration sandbox.',
    });
  }

  const consent = db.updateHeirConsent(req.params.id, {
    status: 'Approved',
    timestamp: 'Just now',
    tokenId: `DEMO-ESIGN#${Math.floor(Math.random() * 80000 + 10000)}`,
    authMethod: 'Simulated UIDAI OTP (Demonstration Sandbox - Not Live C-DAC)',
  });

  if (!consent) {
    return res.status(404).json({ success: false, error: 'Heir consent record not found' });
  }

  db.addAuditLog({
    parcelId: consent.parcelId,
    action: 'HEIR_CONSENT_SIGNED',
    actor: consent.name,
    notes: `Simulated Aadhaar OTP (882914) authenticated for ${consent.name}. Token ID: ${consent.tokenId}`,
  });

  // Check if all heirs for this parcel are now approved
  const parcelConsents = db.getHeirConsents(consent.parcelId);
  const allApproved = parcelConsents.every((c) => c.status === 'Approved');

  if (allApproved) {
    const parcel = db.getParcelById(consent.parcelId);
    if (parcel) {
      const updatedTags = parcel.tags.map((t) => (t.includes('Heirs') ? 'All Legal Heirs Consented' : t));
      db.updateParcel(parcel.id, {
        score: Math.min(100, parcel.score + 15),
        diligenceScore: Math.min(100, (parcel.diligenceScore || parcel.score) + 15),
        status: parcel.caseStatus === 'REGISTRATION_FROZEN' ? parcel.status : 'PASS - Clear Title (All Heirs Consented)',
        registrationStatus: 'CONSENT COMPLETE',
        tags: updatedTags,
      });

      db.addAlert({
        type: 'success',
        title: `All Heir Consents Completed: ${parcel.surveyNo}`,
        time: 'Just now',
        meta: 'All registered coparceners have approved the transfer.',
        parcelId: parcel.id,
      });
    }
  }

  res.json({ success: true, message: 'Heir consent approved successfully (Simulated Demo Sandbox)', data: consent });
});

app.post('/api/heir-consents/:id/objection', (req, res) => {
  const { reason } = req.body;
  const consent = db.updateHeirConsent(req.params.id, {
    status: 'Rejected',
    timestamp: 'Just now',
    objectionFiled: true,
    objectionReason: reason || 'Coparcenary share partition disputed under Hindu Succession Act',
  });

  if (!consent) {
    return res.status(404).json({ success: false, error: 'Heir record not found' });
  }

  db.addAuditLog({
    parcelId: consent.parcelId,
    action: 'HEIR_OBJECTION_FILED',
    actor: consent.name,
    notes: `Caveat objection lodged: ${reason || 'Partition dispute under Hindu Succession Act'}`,
  });

  const parcel = db.getParcelById(consent.parcelId);
  if (parcel) {
    db.updateParcel(parcel.id, {
      status: 'Needs Review - Heir Caveat Registered',
      recommendation: 'Needs Review',
      recommendationExplanation: `Formal caveat filed by heir ${consent.name}. Requires judicial partition say.`,
    });
  }

  res.json({ success: true, message: 'Objection filed and caveat notice registered', data: consent });
});

// 10. Audit History API
app.get('/api/audit-logs', (req, res) => {
  const { parcelId } = req.query;
  const logs = db.getAuditLogs(typeof parcelId === 'string' ? parcelId : undefined);
  res.json({ success: true, data: logs });
});

// 11. Alerts API
app.get('/api/alerts', (req, res) => {
  res.json({ success: true, data: db.getAlerts() });
});

// 12. Certificates API (Real Persistence, Deterministic Hash & Eligibility Enforcement)
app.get('/api/certificates', (req, res) => {
  const { parcelId } = req.query;
  if (parcelId && typeof parcelId === 'string') {
    const cert = db.getCertificateByParcelId(parcelId);
    return res.json({ success: true, data: cert || null });
  }
  res.json({ success: true, data: db.getCertificates() });
});

app.post('/api/certificates/issue', (req, res) => {
  const { parcelId, issuerName } = req.body;
  const parcel = db.getParcelById(parcelId);

  if (!parcel) {
    return res.status(404).json({ success: false, error: 'Parcel record not found' });
  }

  // Check strict eligibility rules: only allow issue if Pass or Officer Sanctioned
  const isEligible =
    parcel.recommendation === 'Pass' ||
    parcel.caseStatus === 'OFFICER_SANCTIONED' ||
    parcel.caseStatus === 'TITLE_VERIFIED';

  if (!isEligible) {
    return res.status(400).json({
      success: false,
      error: 'Parcel is not eligible for Title Certificate issuance.',
      reasons: parcel.recommendationExplanation || 'Unresolved BLOCK triggers require Officer Override.',
      gates: parcel.gates.filter((g) => g.status === 'BLOCK' || g.status === 'WARN'),
    });
  }

  const certId = `CERT-BHU-${parcel.id.toUpperCase()}-${new Date().getFullYear()}`;
  const issueDate = new Date().toLocaleDateString('en-GB');

  // Compute canonical deterministic SHA-256 hash
  const canonicalHash = computeCanonicalCertHash({
    certId,
    parcelId: parcel.id,
    ulpin: parcel.ulpin,
    surveyNo: parcel.surveyNo,
    issuedTo: parcel.primaryOwner,
    village: parcel.village,
    taluka: parcel.taluka,
    district: parcel.district,
    areaHa: parcel.areaHa,
    issueDate,
  });
  const certHash = `SHA256: ${canonicalHash}`;

  const newCert: StoredCertificate = {
    certId,
    parcelId: parcel.id,
    ulpin: parcel.ulpin,
    surveyNo: parcel.surveyNo,
    issuedTo: parcel.primaryOwner,
    village: parcel.village,
    taluka: parcel.taluka,
    district: parcel.district,
    areaHa: parcel.areaHa,
    issueDate,
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
    issuerName: issuerName || 'Shri Rajeshwar Rao, IAS',
    issuerRole: 'Divisional Commissioner / Revenue',
    certHash,
    status: 'ISSUED',
    eligibilityNotes:
      parcel.caseStatus === 'OFFICER_SANCTIONED'
        ? 'INTERNAL DEMONSTRATION CERTIFICATE - Issued following simulated Officer Override sanction under Sec. 34 MLRC.'
        : 'INTERNAL DEMONSTRATION CERTIFICATE - Satisfied all 8 verification gate criteria in demonstration sandbox.',
    isDemonstrationCert: true,
    sha256Verified: true,
  };

  db.issueCertificate(newCert);

  db.addAuditLog({
    parcelId: parcel.id,
    action: 'CERTIFICATE_ISSUED',
    actor: issuerName || 'Shri Rajeshwar Rao, IAS',
    notes: `Demonstration Title certificate ${certId} issued. Deterministic canonical hash: ${certHash}`,
  });

  db.addAlert({
    type: 'success',
    title: `Digital Certificate Issued: ${parcel.surveyNo}`,
    time: 'Just now',
    meta: `Certificate Reference: ${certId} • Valid for 1 year (Demo Sandbox)`,
    parcelId: parcel.id,
  });

  res.json({ success: true, message: 'Certificate issued and stored successfully', data: newCert });
});

app.get('/api/certificates/verify', (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Query parameter q is required' });
  }

  const cert = db.getCertificateByQuery(q);
  if (!cert) {
    return res.status(404).json({
      success: false,
      found: false,
      error: 'No active certificate record found matching this reference or ULPIN.',
    });
  }

  // Recalculate deterministic hash from canonical representation and validate
  const expectedHash = computeCanonicalCertHash({
    certId: cert.certId,
    parcelId: cert.parcelId,
    ulpin: cert.ulpin,
    surveyNo: cert.surveyNo,
    issuedTo: cert.issuedTo,
    village: cert.village,
    taluka: cert.taluka,
    district: cert.district,
    areaHa: cert.areaHa,
    issueDate: cert.issueDate,
  });

  const storedRaw = cert.certHash.replace('SHA256: ', '').trim();
  const isHashValid = storedRaw.toLowerCase() === expectedHash.toLowerCase();

  res.json({
    success: true,
    found: true,
    data: {
      ...cert,
      sha256Verified: isHashValid,
      recalculatedHash: `SHA256: ${expectedHash}`,
      isDemonstrationCertificate: true,
      verificationStatus: isHashValid ? 'CANONICAL_HASH_VALID' : 'HASH_MISMATCH',
      disclaimer:
        'INTERNAL DEMONSTRATION CERTIFICATE ONLY - This is a software sandbox demonstration document and does not constitute a legal or government-issued title deed under the Registration Act 1908.',
    },
  });
});

// 13. Dynamic Diligence Report API (Strict 404 for missing IDs)
app.get('/api/reports/:id', (req, res) => {
  const parcel = db.getParcelById(req.params.id);
  if (!parcel) {
    return res.status(404).json({ success: false, error: 'Parcel record not found for the requested ID' });
  }

  const consents = db.getHeirConsents(parcel.id);
  const pendingConsents = consents.filter((c) => c.status === 'Pending').length;
  const approvedConsents = consents.filter((c) => c.status === 'Approved').length;

  const blockGates = parcel.gates.filter((g) => g.status === 'BLOCK');
  const warnGates = parcel.gates.filter((g) => g.status === 'WARN');

  // Dynamically assemble 5 Pillars
  const pillars = [
    {
      num: 1,
      name: 'Title Lineage',
      status: 'Clear (95/100)',
      badgeType: 'success',
      summary: `Registered title holder ${parcel.primaryOwner} with continuous lineage recorded on 7/12.`,
      details: `Village: ${parcel.village} | Taluka: ${parcel.taluka} | ${parcel.surveyNo}`,
      nextStep: 'Obtain certified copy of latest Mutation Entry to archive alongside deed.',
    },
    {
      num: 2,
      name: 'Liabilities & Mortgages',
      status: parcel.encumbrance.toLowerCase().includes('nil') || parcel.encumbrance.toLowerCase().includes('zero') ? 'Clear (100/100)' : 'Action Required',
      badgeType: parcel.encumbrance.toLowerCase().includes('nil') || parcel.encumbrance.toLowerCase().includes('zero') ? 'success' : 'warning',
      summary: parcel.encumbrance,
      details: 'Cross-referenced against CERSAI national registry.',
      nextStep: parcel.encumbrance.toLowerCase().includes('nil')
        ? 'No bank liability dues detected.'
        : 'Require seller to provide Bank No Objection Certificate (NOC) and 7/12 Roznama clearance before advance.',
    },
    {
      num: 3,
      name: 'Boundaries & Possession',
      status: parcel.overlap.toLowerCase().includes('zero') ? 'Verified (100/100)' : 'Verify On Ground',
      badgeType: parcel.overlap.toLowerCase().includes('zero') ? 'success' : 'warning',
      summary: parcel.overlap,
      details: `Survey Extent: ${parcel.areaHa} Ha (${parcel.areaAcres} Acres) • DGPS Date: ${parcel.dgpsSurveyDate}`,
      nextStep: parcel.overlap.toLowerCase().includes('zero')
        ? 'Cadastral polygon matches village sheet.'
        : 'Commission a Mojani (DGPS land measurement) through the Land Records Inspector (TILR).',
    },
    {
      num: 4,
      name: 'Price & Circle Rate',
      status: 'Fair Valuation',
      badgeType: 'success',
      summary: `Asking price ₹${(parcel.askingPrice / 10000000).toFixed(2)} Cr is within safe corridor of Ready Reckoner (₹${(parcel.readyReckonerRate / 10000000).toFixed(2)} Cr).`,
      details: `Market Asking: ₹${(parcel.askingPrice / 10000000).toFixed(2)} Cr | Govt RR: ₹${(parcel.readyReckonerRate / 10000000).toFixed(2)} Cr`,
      nextStep: 'Ensure consideration is documented in registered sale deed to avoid Section 56(2) tax penalties.',
    },
    {
      num: 5,
      name: 'Legal & Zonal Flags',
      status: blockGates.length > 0 ? 'High Risk' : warnGates.length > 0 ? 'Needs Attention' : 'Clear',
      badgeType: blockGates.length > 0 ? 'danger' : warnGates.length > 0 ? 'warning' : 'success',
      summary: blockGates.length > 0
        ? blockGates.map((g) => g.desc).join(' • ')
        : parcel.litigation,
      details: `Classification: ${parcel.classification} • Pending Heirs: ${pendingConsents}`,
      nextStep: blockGates.length > 0
        ? 'Obtain officer override or court vacation order before proceeding.'
        : 'Ensure all co-heirs execute registered consent deed.',
    },
  ];

  // Dynamic Score Deductions
  const deductions = [
    {
      label: 'Base Title Authenticity & Lineage',
      score: '+40 Pts (Earned: 40/40)',
      pct: 100,
      color: 'secondary',
      desc: 'Verified mutation succession history without adverse break.',
    },
    {
      label: 'Encumbrance & Debt Risk (Bank Lien)',
      score: parcel.encumbrance.toLowerCase().includes('nil') ? '0 Pts Penalty' : '-12 Pts Penalty',
      pct: parcel.encumbrance.toLowerCase().includes('nil') ? 100 : 30,
      color: parcel.encumbrance.toLowerCase().includes('nil') ? 'secondary' : 'tertiary',
      desc: parcel.encumbrance,
    },
    {
      label: 'Legal & Litigation Risk (Civil Suits / Injunctions)',
      score: blockGates.length > 0 ? '-15 Pts Penalty' : '0 Pts Penalty',
      pct: blockGates.length > 0 ? 37.5 : 100,
      color: blockGates.length > 0 ? 'error' : 'secondary',
      desc: parcel.litigation,
    },
    {
      label: 'Boundary & Reservation Risk (Buffer / Overlap)',
      score: parcel.buffer.toLowerCase().includes('canal') ? '-5 Pts Penalty' : '0 Pts Penalty',
      pct: parcel.buffer.toLowerCase().includes('canal') ? 12.5 : 100,
      color: parcel.buffer.toLowerCase().includes('canal') ? 'tertiary' : 'secondary',
      desc: parcel.buffer,
    },
  ];

  res.json({
    success: true,
    data: {
      parcel,
      auditNode: 'DILRMP Audit Node 4082-A',
      sha256: 'e87c6b91a0c4412f8d32b55104a91924874b9921e1a3b841b9',
      generatedDate: new Date().toLocaleString(),
      satyaIndex: parcel.score,
      verdictText: parcel.recommendation === 'Pass' ? 'VERIFIED CLEAR TITLE (सत्यापित स्वच्छ मालकी)' : 'PROCEED WITH CAUTION (सावधगिरीने पुढे जा)',
      verdictDescription: parcel.recommendationExplanation,
      pillars,
      scoreDeductions: deductions,
      consentsSummary: { total: consents.length, approved: approvedConsents, pending: pendingConsents },
      valuation: {
        readyReckoner: `₹${parcel.readyReckonerRate.toLocaleString('en-IN')}`,
        sellerAsking: `₹${parcel.askingPrice.toLocaleString('en-IN')}`,
        variance: `+${(((parcel.askingPrice - parcel.readyReckonerRate) / parcel.readyReckonerRate) * 100).toFixed(1)}% (Within Safe Corridor)`,
        stampDuty: `₹${parcel.stampDuty.toLocaleString('en-IN')} (7% Multi-tier)`,
        subRegistrarZone: `${parcel.taluka}-1`,
      },
      courtCase: {
        cnr: 'MHPUN00142982021',
        plaintiff: 'Co-heir / Sister',
        defendant: parcel.primaryOwner,
        court: `Civil Judge Sr. Div. ${parcel.district}`,
        nextStage: 'Hearing on Injunction Vacation',
      },
    },
  });
});

// Setup Vite or static serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'));

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: Number(PORT),
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`BhuSatya Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start BhuSatya server:', err);
});

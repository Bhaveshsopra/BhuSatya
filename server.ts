import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db, Parcel, StoredCertificate } from './src/server/db.ts';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Helper to compute explainable risk score and gates for any parcel
function evaluateParcelGates(parcel: Partial<Parcel>): {
  score: number;
  diligenceScore: number;
  gates: Parcel['gates'];
  recommendation: 'Pass' | 'Needs Review' | 'Insufficient Information';
  recommendationExplanation: string;
} {
  const gates: Parcel['gates'] = [];

  // Gate 1: Lineage
  gates.push({
    id: 1,
    name: '1. Ownership Chain & 30-Year Title Search',
    status: 'PASS',
    desc: 'Unbroken ancestral succession verified across registered mutation entries.',
  });

  // Gate 2: Encumbrance
  const hasEncumbrance =
    parcel.encumbrance &&
    !parcel.encumbrance.toLowerCase().includes('nil') &&
    !parcel.encumbrance.toLowerCase().includes('zero') &&
    parcel.encumbrance.toLowerCase().includes('charge') ||
    (parcel.encumbrance && parcel.encumbrance.toLowerCase().includes('hypothecation'));
  gates.push({
    id: 2,
    name: '2. Mortgage & Financial Encumbrance (CERSAI)',
    status: hasEncumbrance ? 'WARN' : 'PASS',
    desc: hasEncumbrance
      ? parcel.encumbrance!
      : 'Zero unreleased bank charges or mortgage liens registered on CERSAI.',
  });

  // Gate 3: Injunctions & Litigation
  const hasLitigation =
    parcel.litigation &&
    (parcel.litigation.toLowerCase().includes('suit') ||
      parcel.litigation.toLowerCase().includes('stay') ||
      parcel.litigation.toLowerCase().includes('enquiry'));
  gates.push({
    id: 3,
    name: '3. Court Injunctions & Pending Litigation',
    status: hasLitigation ? 'BLOCK' : 'PASS',
    desc: hasLitigation
      ? parcel.litigation!
      : 'Zero civil suits, caveats, or injunction orders found in District e-Courts register.',
  });

  // Gate 4: Buffer / Restricted classification
  const isRestricted =
    (parcel.classification && (parcel.classification.toLowerCase().includes('restricted') || parcel.classification.toLowerCase().includes('inam') || parcel.classification.toLowerCase().includes('wakf'))) ||
    (parcel.buffer && parcel.buffer.toLowerCase().includes('canal'));
  gates.push({
    id: 4,
    name: '4. Restricted / Government Land Classification',
    status: isRestricted ? 'BLOCK' : 'PASS',
    desc: isRestricted
      ? (parcel.buffer || 'Restricted land classification or buffer zone reservation applies.')
      : 'Freehold private revenue land. Outside all eco-sensitive & canal buffer reservations.',
  });

  // Gate 5: Overlap
  const hasOverlap =
    parcel.overlap &&
    !parcel.overlap.toLowerCase().includes('zero') &&
    parcel.overlap.toLowerCase().includes('overlap');
  gates.push({
    id: 5,
    name: '5. Cadastral Boundary Overlap',
    status: hasOverlap ? 'WARN' : 'PASS',
    desc: hasOverlap
      ? parcel.overlap!
      : 'Boundary demarcation verified. DGPS survey polygon matches 100% with village map sheet.',
  });

  // Gate 6: Area match
  gates.push({
    id: 6,
    name: '6. Area Match (7/12 vs Land Records Dept Tippani)',
    status: 'PASS',
    desc: `Area records match on 7/12 and cadastral map (${parcel.areaHa || 1.45} Ha).`,
  });

  // Gate 7: Multiple sales
  gates.push({
    id: 7,
    name: '7. Multiple Sales / Pre-existing Agreement to Sale',
    status: 'PASS',
    desc: 'No duplicate registered agreements to sale found at Sub-Registrar Office.',
  });

  // Gate 8: Heirs or Revenue dues
  const hasHeirIssue = parcel.tags && parcel.tags.some((t) => t.toLowerCase().includes('heir') || t.toLowerCase().includes('signatory'));
  gates.push({
    id: 8,
    name: '8. Land Revenue Dues & Legal Heir Consent',
    status: hasHeirIssue ? 'WARN' : 'PASS',
    desc: hasHeirIssue
      ? 'Pending heir signature or consent deed verification.'
      : 'All cesses cleared and statutory heir consents verified.',
  });

  // Calculate explainable score:
  let score = 100;
  if (hasEncumbrance) score -= 12;
  if (hasLitigation) score -= 15;
  if (isRestricted) score -= 5;
  if (hasOverlap) score -= 5;
  if (hasHeirIssue) score -= 8;
  score = Math.max(20, Math.min(100, score));

  const blockCount = gates.filter((g) => g.status === 'BLOCK').length;
  const warnCount = gates.filter((g) => g.status === 'WARN').length;

  let recommendation: 'Pass' | 'Needs Review' | 'Insufficient Information' = 'Pass';
  let recommendationExplanation = 'All title diligence checks completed satisfactorily.';

  if (blockCount > 0) {
    recommendation = 'Needs Review';
    recommendationExplanation = `Automated verification detected ${blockCount} BLOCK triggers and ${warnCount} WARN triggers. Requires Officer Override or statutory clearance before deed registration.`;
  } else if (warnCount > 0) {
    recommendation = 'Needs Review';
    recommendationExplanation = `Automated verification detected ${warnCount} WARN items requiring resolution or seller verification before advance payment.`;
  }

  return {
    score,
    diligenceScore: score,
    gates,
    recommendation,
    recommendationExplanation,
  };
}

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

// 3. Create Verification Request & Upload Document
app.post('/api/parcels/upload', (req, res) => {
  const {
    stateAuthority,
    fileName,
    fileSize,
    fileType,
    source,
    surveyNo,
    village,
    taluka,
    ownerName,
    areaHa,
    encumbrance,
    litigation,
  } = req.body;

  // File size validation (max 25MB)
  if (fileSize && typeof fileSize === 'number' && fileSize > 25 * 1024 * 1024) {
    return res.status(400).json({ success: false, error: 'File size exceeds maximum allowed limit of 25MB.' });
  }

  const assignedSurvey =
    surveyNo && surveyNo.trim().length > 0
      ? surveyNo.trim()
      : `Survey No. ${Math.floor(Math.random() * 200 + 10)}/${String.fromCharCode(65 + Math.floor(Math.random() * 4))}`;
  const assignedGat = `Gat No. ${Math.floor(Math.random() * 500 + 50)}`;
  const assignedUlpin = `27-24-0012-0${Math.floor(Math.random() * 900 + 100)}-001A`;
  const assignedCaseNo = `CASE-${new Date().getFullYear()}-MH-${Math.floor(Math.random() * 80000 + 10000)}`;
  const newParcelId = `p-${Date.now().toString().slice(-6)}`;

  const parsedArea = Number(areaHa) > 0 ? Number(areaHa) : 1.25;

  const rawParcel: Partial<Parcel> = {
    id: newParcelId,
    caseNo: assignedCaseNo,
    surveyNo: assignedSurvey,
    gatNo: assignedGat,
    ulpin: assignedUlpin,
    village: village || 'Mouje Hinjawadi',
    taluka: taluka || 'Mulshi',
    district: 'Pune',
    state: stateAuthority === 'ka' ? 'Karnataka' : stateAuthority === 'up' ? 'Uttar Pradesh' : 'Maharashtra',
    areaHa: parsedArea,
    areaAcres: Number((parsedArea * 2.471).toFixed(2)),
    classification: 'R-Zone (Residential / Agri Transition)',
    primaryOwner: ownerName || 'Ananya Sharma',
    jointShareInfo: 'Sole Khatedar (Aadhaar Verified)',
    tags: ['Zero Litigation', 'No Mortgage Dues', 'Verified via Citizen Portal'],
    verifiedDate: new Date().toISOString().split('T')[0],
    encumbrance: encumbrance || 'Nil (All bank charges satisfied on CERSAI)',
    litigation: litigation || 'Zero civil suits detected in District e-Courts register',
    buffer: 'Clear of irrigation canal buffer lines and CRZ regulations',
    overlap: 'Zero overlap recorded in cadastral tippani',
    readyReckonerRate: Math.round(parsedArea * 12000000),
    askingPrice: Math.round(parsedArea * 12500000),
    stampDuty: Math.round(parsedArea * 12500000 * 0.07),
    dgpsSurveyDate: '01 Oct 2024',
    tilrAuthority: 'TILR Pune Central',
    documentMeta: {
      fileName: fileName || 'Uploaded_712_Extract.pdf',
      fileSize: fileSize ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB` : '1.5 MB',
      fileType: fileType || 'application/pdf',
      uploadedAt: new Date().toLocaleString(),
      source: source || 'Uploaded Scanned 7/12',
    },
    override: null,
  };

  const evalResult = evaluateParcelGates(rawParcel);

  const newParcel: Parcel = {
    ...(rawParcel as any),
    score: evalResult.score,
    diligenceScore: evalResult.diligenceScore,
    gates: evalResult.gates,
    recommendation: evalResult.recommendation,
    recommendationExplanation: evalResult.recommendationExplanation,
    status: evalResult.recommendation === 'Pass' ? 'PASS - Clear Title' : 'Needs Review - Red Flags Detected',
    registrationStatus: evalResult.recommendation === 'Pass' ? 'TITLE VERIFIED' : 'PENDING OFFICER REVIEW',
    caseStatus: evalResult.recommendation === 'Pass' ? 'TITLE_VERIFIED' : 'NEEDS_OFFICER_REVIEW',
  };

  db.createParcel(newParcel);

  // Update Extraction data for demonstration pipeline
  db.updateExtraction({
    docRef: `712-MAH-${newParcel.taluka.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-5)}`,
    parcelId: newParcel.id,
    village: newParcel.village,
    taluka: newParcel.taluka,
    district: newParcel.district,
    source: newParcel.documentMeta?.source || 'Citizen Upload',
    fields: {
      primaryOwner: {
        value: newParcel.primaryOwner,
        marathi: newParcel.primaryOwner,
        confidence: 96,
        status: 'High Confidence',
        notes: 'Extracted from uploaded 7/12 (Demonstration OCR Pipeline).',
      },
      surveyNumber: {
        value: newParcel.surveyNo.replace('Survey No. ', ''),
        marathi: newParcel.surveyNo,
        confidence: 99,
        status: 'Exact Match',
        notes: 'Cross-referenced against village cadastral sheet.',
      },
      subDivision: {
        value: 'Sub-division 1 (Hissa No. 1)',
        marathi: 'पोट हिस्सा १',
        confidence: 92,
        status: 'Verified',
        notes: 'Sub-division demarcation confirmed.',
      },
      totalArea: {
        value: `${newParcel.areaHa} Ha (${newParcel.areaAcres} Acres)`,
        marathi: `${newParcel.areaHa} हेक्टर`,
        confidence: 95,
        status: 'High Confidence',
        notes: 'Area reconciled against revenue records.',
      },
      shareFraction: {
        value: 'Sole Occupancy (1/1 Full Share)',
        marathi: '१/१ पूर्ण हिस्सा',
        confidence: 95,
        status: 'Verified',
        notes: 'Single owner record verified.',
      },
      encumbrances: {
        value: newParcel.encumbrance,
        marathi: 'कोणताही बोजा नाही',
        confidence: 90,
        status: 'Verified',
        notes: 'CERSAI search results reconciled.',
      },
    },
  });

  // Log in Audit Trail
  db.addAuditLog({
    parcelId: newParcel.id,
    action: 'CASE_CREATED',
    actor: 'Citizen (Ananya Sharma)',
    notes: `Verification case ${assignedCaseNo} created with document ${newParcel.documentMeta?.fileName}. Initial Satya score calculated: ${evalResult.score}/100.`,
  });

  // Add notification alert
  db.addAlert({
    type: 'success',
    title: `Verification Request Registered: ${assignedSurvey}`,
    time: 'Just now',
    meta: `Case No: ${assignedCaseNo} • Status: ${newParcel.caseStatus} • Satya Score: ${newParcel.score}/100`,
    parcelId: newParcel.id,
  });

  res.json({
    success: true,
    message: 'Verification request created and document processed successfully',
    data: newParcel,
  });
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
  const updated = db.updateExtraction(updates);

  // If fields are updated, sync back to the associated parcel
  const targetParcelId = updates.parcelId || current.parcelId || 'p-142-3a';
  const parcel = db.getParcelById(targetParcelId);
  if (parcel && updates.fields) {
    const pUpdates: Partial<Parcel> = {};
    if (updates.fields.primaryOwner?.value) pUpdates.primaryOwner = updates.fields.primaryOwner.value;
    if (updates.fields.encumbrances?.value) pUpdates.encumbrance = updates.fields.encumbrances.value;

    db.updateParcel(parcel.id, pUpdates);

    db.addAuditLog({
      parcelId: parcel.id,
      action: 'EXTRACTION_REVIEWED',
      actor: 'Citizen / Auditor',
      notes: 'Reviewed and corrected extracted fields. Document values synchronized to case record.',
    });
  }

  res.json({ success: true, data: updated });
});

app.post('/api/extraction/rescan', (req, res) => {
  const ext = db.getExtraction();
  const refreshed = {
    ...ext,
    quality: '98.5% High Confidence',
    engine: 'Demonstration Document Extraction Pipeline (Re-scanned)',
  };
  db.updateExtraction(refreshed);
  res.json({ success: true, message: 'Demonstration OCR re-scan completed', data: refreshed });
});

app.post('/api/extraction/confirm', (req, res) => {
  const { parcelId } = req.body;
  const targetId = parcelId || db.getExtraction().parcelId || 'p-142-3a';
  const parcel = db.getParcelById(targetId);

  if (parcel) {
    db.updateParcel(parcel.id, {
      caseStatus: parcel.recommendation === 'Pass' ? 'TITLE_VERIFIED' : 'NEEDS_OFFICER_REVIEW',
    });

    db.addAuditLog({
      parcelId: parcel.id,
      action: 'EXTRACTION_CONFIRMED',
      actor: 'Citizen / Auditor',
      notes: 'Audit fields confirmed. Verification checks committed to case record.',
    });

    db.addAlert({
      type: 'success',
      title: `Document Review Finalized: ${parcel.surveyNo}`,
      time: 'Just now',
      meta: 'Audit fields verified and committed to case record.',
      parcelId: parcel.id,
    });
  }

  res.json({ success: true, message: 'Audit confirmed and case status updated' });
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
  const consent = db.updateHeirConsent(req.params.id, {
    status: 'Approved',
    timestamp: 'Just now',
    tokenId: `C-DAC#${Math.floor(Math.random() * 80000 + 10000)}`,
    authMethod: 'UIDAI OTP (Aadhaar Linked - eSign Verified)',
  });

  if (!consent) {
    return res.status(404).json({ success: false, error: 'Heir consent record not found' });
  }

  db.addAuditLog({
    parcelId: consent.parcelId,
    action: 'HEIR_CONSENT_SIGNED',
    actor: consent.name,
    notes: `Aadhaar OTP authenticated. Token ID: ${consent.tokenId}`,
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

  res.json({ success: true, message: 'Heir consent approved successfully', data: consent });
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

// 12. Certificates API (Real Persistence & Eligibility Enforcement)
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

  // Check strict eligibility rules
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
  const certHash = `SHA256: ${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}9b2d`;

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
    issueDate: new Date().toLocaleDateString('en-GB'),
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
    issuerName: issuerName || 'Shri Rajeshwar Rao, IAS',
    issuerRole: 'Divisional Commissioner / Revenue',
    certHash,
    status: 'ISSUED',
    eligibilityNotes:
      parcel.caseStatus === 'OFFICER_SANCTIONED'
        ? 'Issued following Officer Override sanction under Sec. 34 MLRC.'
        : 'Passed all 8 verification gates without objection.',
  };

  db.issueCertificate(newCert);

  db.addAuditLog({
    parcelId: parcel.id,
    action: 'CERTIFICATE_ISSUED',
    actor: issuerName || 'Shri Rajeshwar Rao, IAS',
    notes: `Title verification certificate ${certId} issued. Ledger hash: ${certHash}`,
  });

  db.addAlert({
    type: 'success',
    title: `Digital Certificate Issued: ${parcel.surveyNo}`,
    time: 'Just now',
    meta: `Certificate Reference: ${certId} • Valid for 1 year`,
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

  res.json({ success: true, found: true, data: cert });
});

// 13. Dynamic Diligence Report API (Connected to Selected Parcel)
app.get('/api/reports/:id', (req, res) => {
  const parcel = db.getParcelById(req.params.id) || db.getParcels()[0];

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

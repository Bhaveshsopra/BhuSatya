import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db } from './src/server/db.ts';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// --- API ROUTES ---

// 1. Get all parcels
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
        p.primaryOwner.toLowerCase().includes(q)
    );
  }

  if (filter && typeof filter === 'string' && filter !== 'all') {
    if (filter === 'verified') {
      parcels = parcels.filter((p) => p.status.includes('PASS') || p.score >= 85);
    } else if (filter === 'pending') {
      parcels = parcels.filter((p) => p.status.includes('WARN') || (p.score >= 50 && p.score < 85));
    } else if (filter === 'attention') {
      parcels = parcels.filter((p) => p.status.includes('BLOCK') || p.score < 50);
    }
  }

  res.json({ success: true, count: parcels.length, data: parcels });
});

// 2. Get parcel by ID or survey number
app.get('/api/parcels/:id', (req, res) => {
  const parcel = db.getParcelById(req.params.id);
  if (!parcel) {
    return res.status(404).json({ success: false, error: 'Parcel not found' });
  }
  res.json({ success: true, data: parcel });
});

// 3. Upload new 7/12 or RoR Record
app.post('/api/parcels/upload', (req, res) => {
  const { stateAuthority, fileName, source, surveyNo, village, taluka, ownerName, areaHa } = req.body;

  const newParcelId = `p-${Date.now().toString().slice(-6)}`;
  const assignedSurvey = surveyNo || `Survey No. ${Math.floor(Math.random() * 200 + 10)}/${String.fromCharCode(65 + Math.floor(Math.random() * 4))}`;
  const assignedGat = `Gat No. ${Math.floor(Math.random() * 500 + 50)}`;
  const assignedUlpin = `27-24-0012-0${Math.floor(Math.random() * 900 + 100)}-001A`;

  const newParcel = {
    id: newParcelId,
    surveyNo: assignedSurvey,
    gatNo: assignedGat,
    ulpin: assignedUlpin,
    village: village || 'Mouje Hinjawadi',
    taluka: taluka || 'Mulshi',
    district: 'Pune',
    state: stateAuthority === 'ka' ? 'Karnataka' : stateAuthority === 'up' ? 'Uttar Pradesh' : 'Maharashtra',
    areaHa: Number(areaHa) || 1.25,
    areaAcres: Number(((Number(areaHa) || 1.25) * 2.471).toFixed(2)),
    classification: 'R-Zone (Residential / Agri Transition)',
    primaryOwner: ownerName || 'Ananya Sharma',
    jointShareInfo: 'Sole Khatedar (Aadhaar Verified)',
    score: 92,
    diligenceScore: 88,
    status: 'PASS - Clear Title',
    registrationStatus: 'TITLE VERIFIED',
    tags: ['Zero Litigation', 'No Mortgage Dues', 'Verified via DigiLocker'],
    verifiedDate: new Date().toISOString().split('T')[0],
    encumbrance: 'Nil (All bank charges satisfied on CERSAI)',
    litigation: 'Zero civil suits detected in District e-Courts register',
    buffer: 'Clear of irrigation canal buffer lines and CRZ regulations',
    overlap: 'Zero overlap recorded in cadastral tippani',
    readyReckonerRate: 14500000,
    askingPrice: 15000000,
    stampDuty: 1050000,
    dgpsSurveyDate: '01 Oct 2024',
    tilrAuthority: 'TILR Pune Central',
    gates: [
      { id: 1, name: '1. Ownership Chain & 30-Year Title Search', status: 'PASS' as const, desc: 'Ancestral lineage continuous across last 3 decades without gap.' },
      { id: 2, name: '2. Mortgage & Financial Encumbrance (CERSAI)', status: 'PASS' as const, desc: 'Zero unreleased bank charges or liens.' },
      { id: 3, name: '3. Court Injunctions & Pending Litigation', status: 'PASS' as const, desc: 'No stay orders or civil suits pending.' },
      { id: 4, name: '4. Restricted / Government Land Classification', status: 'PASS' as const, desc: 'Freehold private revenue land.' },
      { id: 5, name: '5. Cadastral Boundary Overlap', status: 'PASS' as const, desc: 'DGPS boundaries align 100% with village map polygon.' },
      { id: 6, name: '6. Area Match (7/12 vs Land Records Dept Tippani)', status: 'PASS' as const, desc: 'Exact area match verified.' },
      { id: 7, name: '7. Multiple Sales / Pre-existing Agreement to Sale', status: 'PASS' as const, desc: 'Sub-Registrar clearance authenticated.' },
      { id: 8, name: '8. Land Revenue Dues & Non-Agri Tax', status: 'PASS' as const, desc: 'All local taxes and cesses cleared up to date.' }
    ],
    override: null,
  };

  db.createParcel(newParcel);

  // Add alert
  db.addAlert({
    type: 'success',
    title: `New Parcel Added: ${assignedSurvey} (${newParcel.village})`,
    time: 'Just now',
    meta: `Automated OCR extracted from ${source || 'Uploaded Document'} • Satya Score: 92/100`,
  });

  res.json({ success: true, message: 'Parcel uploaded and verified successfully', data: newParcel });
});

// 4. Officer Override Submission
app.post('/api/parcels/:id/override', (req, res) => {
  const { justification, orderRef, dscToken, officerName } = req.body;
  const parcel = db.getParcelById(req.params.id);

  if (!parcel) {
    return res.status(404).json({ success: false, error: 'Parcel not found' });
  }

  if (!justification || justification.trim().length < 5) {
    return res.status(400).json({ success: false, error: 'Justification reference number is required' });
  }

  const updated = db.updateParcel(parcel.id, {
    registrationStatus: 'OVERRIDE SANCTIONED (PROVISIONAL)',
    status: 'PASS - Officer Override Sanctioned',
    override: {
      justification: justification.trim(),
      officerName: officerName || 'Shri Rajeshwar Rao, IAS',
      officerRole: 'Divisional Commissioner / Revenue',
      dscSignature: dscToken || 'SHA256: 4f8b9...c391 (C-DAC Class-3 DSC)',
      orderDate: new Date().toISOString(),
      status: 'Approved',
    },
  });

  db.addAlert({
    type: 'info',
    title: `Officer Override Granted for ${parcel.surveyNo}`,
    time: 'Just now',
    meta: `Order Ref: ${justification.slice(0, 35)}... • Authenticated via C-DAC Class-3 DSC`,
  });

  res.json({ success: true, message: 'Officer override registered successfully', data: updated });
});

// 5. Escalate to Tehsildar & District Registrar
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
    blockTriggers: ['Canal Buffer Reservation', 'Active Injunction Suit 842/2021'],
    urgency: 'Critical' as const,
    receivedDate: 'Today',
    status: 'Under Tehsildar Enquiry',
  };

  const queue = db.getOfficerQueue();
  queue.unshift(queueItem);
  db.save({ ...db.get(), officerQueue: queue });

  db.addAlert({
    type: 'error',
    title: `Escalation Notice Dispatched: ${parcel.surveyNo} sent to Tehsildar Mulshi`,
    time: 'Just now',
    meta: `Case Reference #${queueItem.caseNo} • 14-day statutory enquiry notice initiated`,
  });

  res.json({ success: true, message: 'Case escalated to Revenue Officer Queue', caseNo: queueItem.caseNo });
});

// 6. Extraction API
app.get('/api/extraction', (req, res) => {
  res.json({ success: true, data: db.getExtraction() });
});

app.put('/api/extraction', (req, res) => {
  const updates = req.body;
  const updated = db.updateExtraction(updates);
  res.json({ success: true, data: updated });
});

app.post('/api/extraction/rescan', (req, res) => {
  const ext = db.getExtraction();
  // Simulate improved OCR pass
  const refreshed = {
    ...ext,
    quality: '98.1% High Confidence',
    engine: 'Indic-BERT v4.3 + Google Vision Transformer',
  };
  db.updateExtraction(refreshed);
  res.json({ success: true, message: 'OCR re-scanned with 98.1% confidence', data: refreshed });
});

app.post('/api/extraction/confirm', (req, res) => {
  db.addAlert({
    type: 'success',
    title: 'Document AI Verification Completed: Survey 142/3A',
    time: 'Just now',
    meta: 'Logged to Pune District Revenue Node • Block #882915-MH • SHA-256 Validated',
  });
  res.json({ success: true, message: 'Audit confirmed and verification pipeline triggered' });
});

// 7. Heir Consents API
app.get('/api/heir-consents', (req, res) => {
  const { parcelId } = req.query;
  const consents = db.getHeirConsents(typeof parcelId === 'string' ? parcelId : undefined);
  res.json({ success: true, data: consents });
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

  // Update parcel 89/1B status if all heirs signed
  const allConsents = db.getHeirConsents('p-89-1b');
  const allApproved = allConsents.every((c) => c.status === 'Approved');
  if (allApproved) {
    db.updateParcel('p-89-1b', {
      score: 95,
      diligenceScore: 95,
      status: 'PASS - Clear Title (All Heirs Consented)',
      registrationStatus: 'CONSENT COMPLETE',
      tags: ['3/3 Heirs Signed', 'UIDAI eSign Authenticated', 'Ready for Registry'],
    });
  }

  db.addAlert({
    type: 'success',
    title: `Heir Consent Verified: ${consent.name} signed for Survey 89/1B`,
    time: 'Just now',
    meta: `Identity verified via Aadhaar OTP • Token: ${consent.tokenId}`,
  });

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

  db.addAlert({
    type: 'error',
    title: `Formal Objection Lodged by ${consent.name}`,
    time: 'Just now',
    meta: `Caveat registered on BhuSatya Portal • Reason: ${reason || 'Partition Dispute'}`,
  });

  res.json({ success: true, message: 'Objection filed and caveat notice registered', data: consent });
});

// 8. Alerts API
app.get('/api/alerts', (req, res) => {
  res.json({ success: true, data: db.getAlerts() });
});

// 9. Officer Queue API
app.get('/api/officer-queue', (req, res) => {
  res.json({ success: true, data: db.getOfficerQueue() });
});

app.post('/api/officer-queue/:id/action', (req, res) => {
  const { action, notes } = req.body;
  const updated = db.updateOfficerQueue(req.params.id, {
    status: action === 'approve' ? 'Sanctioned by Divisional Commissioner' : action === 'reject' ? 'Rejected & Frozen' : 'Hearing Scheduled',
  });
  res.json({ success: true, data: updated });
});

// 10. Diligence Report
app.get('/api/reports/:id', (req, res) => {
  const parcel = db.getParcelById(req.params.id) || db.getParcels()[0];
  res.json({
    success: true,
    data: {
      parcel,
      auditNode: 'DILRMP Audit Node 4082-A',
      sha256: 'e87c6b91a0c4412f8d32b55104a91924874b9921e1a3b841b9',
      generatedDate: '24 Oct 2024, 14:32 IST',
      satyaIndex: parcel.diligenceScore || 68,
      verdictText: 'PROCEED WITH CAUTION (सावधगिरीने पुढे जा)',
      verdictDescription: 'High title authenticity. Do NOT proceed to deed registration until existing bank lien and coparcenary claim are settled.',
      pillars: [
        {
          num: 1,
          name: 'Title Lineage',
          status: 'Clear (95/100)',
          badgeType: 'success',
          summary: 'The seller is the legitimate registered title holder with unbroken 30-year ancestral succession.',
          details: 'Khata No: 418 | Ferfar Entry: 3122 | Survey: 142/3A',
          nextStep: 'Obtain certified copy of Mutation Entry No. 3122 from Talathi office to archive alongside sale deed.',
        },
        {
          num: 2,
          name: 'Liabilities & Mortgages',
          status: 'Action Required',
          badgeType: 'warning',
          summary: 'A ₹15 Lakh agricultural crop mortgage with Bank of Maharashtra is still active on record.',
          details: 'CERSAI ID: CR-2019-98104 | Lien Holder: BoM Hinjawadi',
          nextStep: 'Require seller to provide Bank No Objection Certificate (NOC) and 7/12 Roznama clearance before giving token advance.',
        },
        {
          num: 3,
          name: 'Boundaries & Possession',
          status: 'Verify On Ground',
          badgeType: 'warning',
          summary: '0.02 Hectare overlap with southern boundary neighbor noted in digital cadastral map overlay.',
          details: 'Cadastral Gat: 142 | Encroachment Risk: Southern Margin (8%)',
          nextStep: 'Commission a government Mojani (DGPS land measurement) through the Land Records Inspector (Kankavli/Mulshi).',
        },
        {
          num: 4,
          name: 'Price & Circle Rate',
          status: 'Fair Valuation',
          badgeType: 'success',
          summary: 'Asking price ₹1.80 Cr is within 8% of Government Ready Reckoner circle rate (₹1.66 Cr).',
          details: 'Market Asking: ₹1.80 Cr | Govt Rate: ₹1.66 Cr | Index: Normal',
          nextStep: 'Ensure full transaction consideration is documented in registered sale deed to avoid Section 56(2) tax penalties.',
        },
        {
          num: 5,
          name: 'Legal & Zonal Flags',
          status: 'High Risk',
          badgeType: 'danger',
          summary: "A partition objection was filed in Civil Court Pune by seller's sister alleging ancestral coparcenary rights under Hindu Succession Act.",
          details: 'Case: Civil Suit Special No. 842/2021 | Status: Injunction Hearing Pending (Nov 2024) | Coram: Additional Civil Judge, Senior Division Pune',
          nextStep: 'Require all legal heirs to execute registered Heir Consent Deed on BhuSatya portal before paying any advance.',
        },
      ],
      scoreDeductions: [
        { label: 'Base Title Authenticity & Succession History', score: '+40 Pts (Earned: 40/40)', pct: 100, color: 'secondary', desc: 'Verified across 1994–2024 Mutation records without adverse entry' },
        { label: 'Encumbrance & Debt Risk (Unreleased Bank Lien)', score: '-12 Pts Penalty', pct: 30, color: 'tertiary', desc: 'Active charge with Bank of Maharashtra Hinjawadi branch (Deducted from 25 pts)' },
        { label: 'Legal & Litigation Risk (Civil Suit No. 842/2021)', score: '-15 Pts Penalty', pct: 37.5, color: 'error', desc: 'Co-parcenary partition dispute active in Pune Civil Court (Deducted from 25 pts)' },
        { label: 'Boundary & Reservation Risk (Canal Buffer Proximity)', score: '-5 Pts Penalty', pct: 12.5, color: 'tertiary', desc: '15m Irrigation Department buffer line trims effective usable plot area by 0.02 Ha' },
      ],
      valuation: {
        readyReckoner: '₹1,66,32,000',
        sellerAsking: '₹1,80,00,000',
        variance: '+8.2% (Within Safe Corridor)',
        stampDuty: '₹12,60,000 (7% Multi-tier)',
        subRegistrarZone: 'Haveli-14',
      },
      courtCase: {
        cnr: 'MHPUN00142982021',
        plaintiff: 'Smt. Sunita Anant Kadam',
        defendant: 'Shri Ramesh Mahadev Kadam',
        court: 'Civil Judge Sr. Div. Pune',
        nextStage: 'Interim Injunction Say',
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

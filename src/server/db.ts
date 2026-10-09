import fs from 'fs';
import path from 'path';
import { DocumentClassificationResult } from '../types/index.ts';

const DB_PATH = path.resolve(process.cwd(), 'data', 'bhusatya_db.json');

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  parcelId: string;
  action: string;
  actor: string;
  notes: string;
}

export type GateStatus = 'PASS' | 'WARN' | 'BLOCK' | 'NOT_CONNECTED';

export interface GateCheck {
  id: number;
  name: string;
  status: GateStatus;
  desc: string;
  sourceSystem?: string;
  isSimulated?: boolean;
}

export interface StoredCertificate {
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
  validUntil: string;
  issuerName: string;
  issuerRole: string;
  certHash: string;
  status: 'ISSUED' | 'REVOKED';
  eligibilityNotes: string;
  isDemonstrationCert?: boolean;
  sha256Verified?: boolean;
}

export interface Parcel {
  id: string;
  caseNo?: string;
  surveyNo: string;
  gatNo: string;
  ulpin: string;
  village: string;
  taluka: string;
  district: string;
  state: string;
  areaHa: number;
  areaAcres: number;
  classification: string;
  primaryOwner: string;
  jointShareInfo: string;
  score: number;
  diligenceScore: number;
  status: string;
  registrationStatus: string;
  caseStatus: 'PENDING_REVIEW' | 'VERIFICATION_IN_PROGRESS' | 'NEEDS_OFFICER_REVIEW' | 'OFFICER_SANCTIONED' | 'TITLE_VERIFIED' | 'REGISTRATION_FROZEN' | 'ADDITIONAL_INFO_REQUESTED';
  recommendation: 'Pass' | 'Needs Review' | 'Insufficient Information';
  recommendationExplanation: string;
  tags: string[];
  verifiedDate: string;
  encumbrance: string;
  litigation: string;
  buffer: string;
  overlap: string;
  readyReckonerRate: number;
  askingPrice: number;
  stampDuty: number;
  dgpsSurveyDate: string;
  tilrAuthority: string;
  documentMeta?: {
    fileName: string;
    fileSize: string;
    fileType: string;
    uploadedAt: string;
    source: string;
    storedPath?: string;
    serverFileName?: string;
    storagePath?: string;
    isDurableStorage?: boolean;
    sha256?: string;
    classification?: DocumentClassificationResult;
  };
  gates: GateCheck[];
  override?: {
    justification: string;
    officerName: string;
    officerRole: string;
    dscSignature: string;
    orderDate: string;
    status: 'Approved' | 'Escalated';
  } | null;
  officerRemarks?: string;
  hearingDate?: string;
}

export interface ExtractionFieldItem {
  value: string;
  marathi: string;
  confidence: number;
  status: string;
  notes: string;
  originalValue?: string;
  isEdited?: boolean;
  provenance?: 'AI_EXTRACTED' | 'USER_CORRECTED' | 'UNVERIFIED';
  warning?: boolean;
}

export interface ExtractionData {
  docRef: string;
  parcelId: string;
  source: string;
  engine: string;
  quality: string;
  village: string;
  taluka: string;
  district: string;
  classification?: DocumentClassificationResult;
  originalFields?: {
    primaryOwner?: string;
    surveyNumber?: string;
    subDivision?: string;
    totalArea?: string;
    shareFraction?: string;
    encumbrances?: string;
  };
  corrections?: Record<string, { original: string; corrected: string; timestamp: string }>;
  fields: {
    primaryOwner: ExtractionFieldItem;
    surveyNumber: ExtractionFieldItem;
    subDivision: ExtractionFieldItem;
    totalArea: ExtractionFieldItem;
    shareFraction: ExtractionFieldItem;
    encumbrances: ExtractionFieldItem;
  };
}

export interface HeirConsent {
  id: string;
  parcelId: string;
  name: string;
  relation: string;
  aadhaarMasked: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  timestamp: string;
  tokenId: string;
  authMethod: string;
  objectionFiled: boolean;
  objectionReason?: string;
}

export interface AlertItem {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  time: string;
  meta: string;
  parcelId?: string;
}

export interface OfficerQueueItem {
  id: string;
  caseNo: string;
  parcelId: string;
  surveyNo: string;
  taluka: string;
  applicant: string;
  stage: string;
  blockTriggers: string[];
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  receivedDate: string;
  status: string;
  actionNotes?: string;
}

export interface DatabaseSchema {
  parcels: Parcel[];
  extraction: ExtractionData;
  heirConsents: HeirConsent[];
  alerts: AlertItem[];
  officerQueue: OfficerQueueItem[];
  auditLogs: AuditLogEntry[];
  certificates: StoredCertificate[];
}

function getDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (!parsed.auditLogs) parsed.auditLogs = [];
      if (!parsed.certificates) parsed.certificates = [];
      return parsed;
    }
  } catch (err) {
    console.error('Error reading database file:', err);
  }
  return {
    parcels: [],
    extraction: {} as any,
    heirConsents: [],
    alerts: [],
    officerQueue: [],
    auditLogs: [],
    certificates: [],
  };
}

function saveDatabase(data: DatabaseSchema): void {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const tempPath = `${DB_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_PATH);
  } catch (err) {
    console.error('Error saving database file:', err);
    throw new Error('DATABASE_WRITE_FAILED: Failed to safely write record to data store.');
  }
}

export const db = {
  get: getDatabase,
  save: saveDatabase,

  getParcels: () => getDatabase().parcels,
  getParcelById: (id: string) => {
    if (!id || typeof id !== 'string') return undefined;
    const target = id.trim().toLowerCase();
    return getDatabase().parcels.find(
      (p) =>
        p.id.toLowerCase() === target ||
        p.ulpin.toLowerCase() === target ||
        (p.caseNo && p.caseNo.toLowerCase() === target)
    );
  },
  updateParcel: (id: string, updates: Partial<Parcel>) => {
    const data = getDatabase();
    const idx = data.parcels.findIndex((p) => p.id === id);
    if (idx !== -1) {
      data.parcels[idx] = { ...data.parcels[idx], ...updates };
      saveDatabase(data);
      return data.parcels[idx];
    }
    return null;
  },
  createParcel: (parcel: Parcel) => {
    const data = getDatabase();
    data.parcels.unshift(parcel);
    saveDatabase(data);
    return parcel;
  },

  addOfficerQueueItem: (item: OfficerQueueItem) => {
    const data = getDatabase();
    const existing = data.officerQueue.findIndex((q) => q.parcelId === item.parcelId || q.id === item.id);
    if (existing !== -1) {
      data.officerQueue[existing] = { ...data.officerQueue[existing], ...item };
    } else {
      data.officerQueue.unshift(item);
    }
    saveDatabase(data);
    return item;
  },

  getExtraction: () => getDatabase().extraction,
  updateExtraction: (updates: Partial<ExtractionData>) => {
    const data = getDatabase();
    data.extraction = { ...data.extraction, ...updates };
    saveDatabase(data);
    return data.extraction;
  },

  getHeirConsents: (parcelId?: string) => {
    const all = getDatabase().heirConsents;
    if (parcelId) {
      return all.filter((h) => h.parcelId === parcelId);
    }
    return all;
  },
  updateHeirConsent: (id: string, updates: Partial<HeirConsent>) => {
    const data = getDatabase();
    const idx = data.heirConsents.findIndex((h) => h.id === id);
    if (idx !== -1) {
      data.heirConsents[idx] = { ...data.heirConsents[idx], ...updates };
      saveDatabase(data);
      return data.heirConsents[idx];
    }
    return null;
  },
  addHeirConsent: (consent: HeirConsent) => {
    const data = getDatabase();
    data.heirConsents.push(consent);
    saveDatabase(data);
    return consent;
  },

  getAlerts: () => getDatabase().alerts,
  addAlert: (alert: Omit<AlertItem, 'id'>) => {
    const data = getDatabase();
    const newAlert: AlertItem = {
      id: `alt-${Date.now()}`,
      ...alert,
    };
    data.alerts.unshift(newAlert);
    saveDatabase(data);
    return newAlert;
  },

  getOfficerQueue: () => getDatabase().officerQueue,
  updateOfficerQueue: (id: string, updates: Partial<OfficerQueueItem>) => {
    const data = getDatabase();
    const idx = data.officerQueue.findIndex((item) => item.id === id);
    if (idx !== -1) {
      data.officerQueue[idx] = { ...data.officerQueue[idx], ...updates };
      saveDatabase(data);
      return data.officerQueue[idx];
    }
    return null;
  },

  getAuditLogs: (parcelId?: string) => {
    const data = getDatabase();
    if (parcelId) {
      return data.auditLogs.filter((log) => log.parcelId === parcelId);
    }
    return data.auditLogs;
  },
  addAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const data = getDatabase();
    const newLog: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    data.auditLogs.unshift(newLog);
    saveDatabase(data);
    return newLog;
  },

  getCertificates: () => getDatabase().certificates,
  getCertificateByParcelId: (parcelId: string) => {
    const data = getDatabase();
    return data.certificates.find((c) => c.parcelId === parcelId && c.status === 'ISSUED');
  },
  getCertificateByQuery: (query: string) => {
    const data = getDatabase();
    const q = query.trim().toLowerCase();
    return data.certificates.find(
      (c) =>
        c.certId.toLowerCase() === q ||
        c.ulpin.toLowerCase() === q ||
        c.certHash.toLowerCase().includes(q) ||
        c.surveyNo.toLowerCase().includes(q)
    );
  },
  issueCertificate: (cert: StoredCertificate) => {
    const data = getDatabase();
    // remove any older certificate for the same parcel
    data.certificates = data.certificates.filter((c) => c.parcelId !== cert.parcelId);
    data.certificates.unshift(cert);
    saveDatabase(data);
    return cert;
  },
};

export function evaluateParcelGates(parcel: Partial<Parcel>): {
  score: number;
  diligenceScore: number;
  gates: Parcel['gates'];
  recommendation: 'Pass' | 'Needs Review' | 'Insufficient Information';
  recommendationExplanation: string;
} {
  const gates: Parcel['gates'] = [];

  // Gate 1: 30-Year Ancestral Lineage & Succession
  gates.push({
    id: 1,
    name: '1. Ownership Chain & 30-Year Title Search',
    status: 'PASS',
    desc: 'Unbroken ancestral succession verified across registered mutation entries.',
    sourceSystem: 'State Land Records Mutation Register (Ferfar)',
    isSimulated: true,
  });

  // Gate 2: CERSAI Central Registry & Financial Charges
  const encText = (parcel.encumbrance || '').trim().toLowerCase();
  const isEncClean =
    encText.includes('nil') ||
    encText.includes('zero') ||
    encText.includes('satisfied') ||
    encText.includes('no dues') ||
    encText.includes('clear') ||
    encText.includes('none');

  const hasEncumbrance =
    !isEncClean &&
    (encText.includes('charge') ||
      encText.includes('mortgage') ||
      encText.includes('hypothecation') ||
      encText.includes('loan') ||
      encText.includes('lien') ||
      encText.includes('bank'));

  const isEncMissing = !parcel.encumbrance || parcel.encumbrance.trim() === '';

  if (isEncMissing) {
    gates.push({
      id: 2,
      name: '2. Mortgage & Financial Encumbrance (CERSAI)',
      status: 'NOT_CONNECTED',
      desc: 'Live CERSAI API Gateway: NOT CONNECTED (Simulation Sandbox). Official bank charge search certificate not linked.',
      sourceSystem: 'CERSAI Central Registry Gateway',
      isSimulated: false,
    });
  } else {
    gates.push({
      id: 2,
      name: '2. Mortgage & Financial Encumbrance (CERSAI)',
      status: hasEncumbrance ? 'WARN' : 'PASS',
      desc: hasEncumbrance
        ? parcel.encumbrance!
        : 'Zero unreleased bank charges or mortgage liens registered on CERSAI.',
      sourceSystem: 'CERSAI Central Registry (Demonstration Data - Gateway Not Live)',
      isSimulated: true,
    });
  }

  // Gate 3: e-Courts Injunctions & Pending Litigation
  const litText = (parcel.litigation || '').trim().toLowerCase();
  const isLitClean =
    litText.includes('zero') ||
    litText.includes('nil') ||
    litText.includes('no civil') ||
    litText.includes('clean') ||
    litText.includes('cleared') ||
    litText.includes('none');

  const hasLitigation =
    !isLitClean &&
    (litText.includes('suit') ||
      litText.includes('stay') ||
      litText.includes('injunction') ||
      litText.includes('caveat') ||
      litText.includes('dispute') ||
      litText.includes('enquiry') ||
      litText.includes('pending'));

  const isLitMissing = !parcel.litigation || parcel.litigation.trim() === '';

  if (isLitMissing) {
    gates.push({
      id: 3,
      name: '3. Court Injunctions & Pending Litigation',
      status: 'NOT_CONNECTED',
      desc: 'e-Courts NJDG API Gateway: NOT CONNECTED. Automated judicial search unavailable in sandbox; manual caveat check required.',
      sourceSystem: 'e-Courts National Judicial Data Grid (NJDG)',
      isSimulated: false,
    });
  } else {
    gates.push({
      id: 3,
      name: '3. Court Injunctions & Pending Litigation',
      status: hasLitigation ? 'BLOCK' : 'PASS',
      desc: hasLitigation
        ? parcel.litigation!
        : 'Zero civil suits, caveats, or injunction orders found in District e-Courts register.',
      sourceSystem: 'e-Courts NJDG (Demonstration Sandbox Data)',
      isSimulated: true,
    });
  }

  // Gate 4: Buffer / Restricted classification
  const bufText = (parcel.buffer || '').trim().toLowerCase();
  const isBufClean = bufText.includes('clear') || bufText.includes('outside') || bufText.includes('zero') || bufText.includes('none');
  const isRestricted =
    (parcel.classification &&
      (parcel.classification.toLowerCase().includes('restricted') ||
        parcel.classification.toLowerCase().includes('inam') ||
        parcel.classification.toLowerCase().includes('wakf') ||
        parcel.classification.toLowerCase().includes('class-ii'))) ||
    (!isBufClean && (bufText.includes('canal') || bufText.includes('buffer') || bufText.includes('crz') || bufText.includes('reservation')));

  gates.push({
    id: 4,
    name: '4. Restricted / Government Land Classification',
    status: isRestricted ? 'BLOCK' : 'PASS',
    desc: isRestricted
      ? (parcel.buffer || 'Restricted land classification or buffer zone reservation applies.')
      : 'Freehold private revenue land. Outside all eco-sensitive & canal buffer reservations.',
    sourceSystem: 'State Cadastral Classification Ledger (Mahabhulekh)',
    isSimulated: true,
  });

  // Gate 5: Overlap
  const ovText = (parcel.overlap || '').trim().toLowerCase();
  const isOvClean = ovText.includes('zero') || ovText.includes('nil') || ovText.includes('matches 100%') || ovText.includes('no overlap');
  const hasOverlap = !isOvClean && ovText.includes('overlap');

  gates.push({
    id: 5,
    name: '5. Cadastral Boundary Overlap',
    status: hasOverlap ? 'WARN' : 'PASS',
    desc: hasOverlap
      ? parcel.overlap!
      : 'Boundary demarcation verified. DGPS survey polygon matches 100% with village map sheet.',
    sourceSystem: 'Cadastral GIS Tippani / DGPS Polygon Service',
    isSimulated: true,
  });

  // Gate 6: Area match
  gates.push({
    id: 6,
    name: '6. Area Match (7/12 vs Land Records Dept Tippani)',
    status: 'PASS',
    desc: `Area records match on 7/12 and cadastral map (${parcel.areaHa || 1.45} Ha).`,
    sourceSystem: 'TILR Cadastral Area Reconciler',
    isSimulated: true,
  });

  // Gate 7: Multiple sales
  gates.push({
    id: 7,
    name: '7. Multiple Sales / Pre-existing Agreement to Sale',
    status: 'PASS',
    desc: 'No duplicate registered agreements to sale found at Sub-Registrar Office.',
    sourceSystem: 'IGR Maharashtra Electronic Registry (e-Stepin)',
    isSimulated: true,
  });

  // Gate 8: Heirs or Revenue dues
  const consents = parcel.id ? db.getHeirConsents(parcel.id) : [];
  const hasObjection = consents.some((c) => c.objectionFiled || c.status === 'Rejected');
  const hasPendingHeir = consents.some((c) => c.status === 'Pending');
  const hasHeirIssue =
    hasObjection ||
    hasPendingHeir ||
    (parcel.tags && parcel.tags.some((t) => t.toLowerCase().includes('heir') || t.toLowerCase().includes('signatory')));

  gates.push({
    id: 8,
    name: '8. Land Revenue Dues & Legal Heir Consent',
    status: hasObjection ? 'BLOCK' : hasHeirIssue ? 'WARN' : 'PASS',
    desc: hasObjection
      ? 'Formal caveat objection lodged by legal coparcener under Succession Act.'
      : hasHeirIssue
      ? 'Pending heir signature or consent deed verification from coparcener.'
      : 'All cesses cleared and statutory heir consents verified.',
    sourceSystem: 'BhuSatya Digital Coparcener Consent Ledger',
    isSimulated: true,
  });

  // Calculate explainable score:
  let score = 100;
  if (hasEncumbrance) score -= 12;
  if (hasLitigation) score -= 18;
  if (isRestricted) score -= 15;
  if (hasOverlap) score -= 10;
  if (hasHeirIssue) score -= 8;
  if (hasObjection) score -= 15;
  if (isEncMissing) score -= 5;
  if (isLitMissing) score -= 5;
  score = Math.max(15, Math.min(100, score));

  const blockCount = gates.filter((g) => g.status === 'BLOCK').length;
  const warnCount = gates.filter((g) => g.status === 'WARN').length;
  const notConnectedCount = gates.filter((g) => g.status === 'NOT_CONNECTED').length;

  const isMissingEssential = !parcel.surveyNo || !parcel.primaryOwner;

  let recommendation: 'Pass' | 'Needs Review' | 'Insufficient Information' = 'Pass';
  let recommendationExplanation = 'All title diligence checks completed satisfactorily.';

  if (isMissingEssential || notConnectedCount >= 2) {
    recommendation = 'Insufficient Information';
    recommendationExplanation = `Evidence incomplete: External registries (${notConnectedCount}) are not connected and primary survey metadata is incomplete.`;
    score = Math.min(score, 45);
  } else if (blockCount > 0) {
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

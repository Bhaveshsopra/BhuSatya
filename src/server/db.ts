import fs from 'fs';
import path from 'path';

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

export interface ExtractionData {
  docRef: string;
  parcelId: string;
  source: string;
  engine: string;
  quality: string;
  village: string;
  taluka: string;
  district: string;
  fields: {
    primaryOwner: { value: string; marathi: string; confidence: number; status: string; notes: string };
    surveyNumber: { value: string; marathi: string; confidence: number; status: string; notes: string };
    subDivision: { value: string; marathi: string; confidence: number; status: string; notes: string };
    totalArea: { value: string; marathi: string; confidence: number; status: string; notes: string };
    shareFraction: { value: string; marathi: string; confidence: number; status: string; notes: string; warning?: boolean };
    encumbrances: { value: string; marathi: string; confidence: number; status: string; notes: string; warning?: boolean };
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

import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'data', 'bhusatya_db.json');

export interface Parcel {
  id: string;
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
  gates: Array<{
    id: number;
    name: string;
    status: 'PASS' | 'WARN' | 'BLOCK';
    desc: string;
  }>;
  override?: {
    justification: string;
    officerName: string;
    officerRole: string;
    dscSignature: string;
    orderDate: string;
    status: 'Approved' | 'Escalated';
  } | null;
}

export interface ExtractionData {
  docRef: string;
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
}

export interface DatabaseSchema {
  parcels: Parcel[];
  extraction: ExtractionData;
  heirConsents: HeirConsent[];
  alerts: AlertItem[];
  officerQueue: OfficerQueueItem[];
}

function getDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading database file:', err);
  }
  // Fallback return empty shell
  return {
    parcels: [],
    extraction: {} as any,
    heirConsents: [],
    alerts: [],
    officerQueue: [],
  };
}

function saveDatabase(data: DatabaseSchema): void {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

export const db = {
  get: getDatabase,
  save: saveDatabase,

  getParcels: () => getDatabase().parcels,
  getParcelById: (id: string) => getDatabase().parcels.find((p) => p.id === id || p.ulpin === id || p.surveyNo.includes(id)),
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
};

export type Language = 'EN' | 'HI' | 'MR';

export type ActiveTab =
  | 'citizen-dashboard'
  | 'extract-and-review'
  | 'parcel-check-and-red-flag-gate'
  | 'heir-consent-tracker'
  | 'should-i-buy-this-report'
  | 'certificate-and-verifier'
  | 'revenue-officer-queue';

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

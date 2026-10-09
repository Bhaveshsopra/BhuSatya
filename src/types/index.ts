export type Language = 'EN' | 'HI' | 'MR';

export type ActiveTab =
  | 'citizen-dashboard'
  | 'extract-and-review'
  | 'parcel-check-and-red-flag-gate'
  | 'heir-consent-tracker'
  | 'should-i-buy-this-report'
  | 'certificate-and-verifier'
  | 'revenue-officer-queue';

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
  classificationConfidence: number;
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
  stageResults?: {
    stageA_fileValidation: { passed: boolean; message: string; mimeTypeDetected?: string };
    stageB_classification: { passed: boolean; detectedType: LandDocumentType; confidence: number };
    stageC_ocrEvidence: { passed: boolean; matchedKeywordsCount: number; matchedKeywords: string[] };
    stageD_decision: { status: DocumentValidationStatus; decisionNotes: string };
  };
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
  fields: {
    primaryOwner: { value: string; marathi: string; confidence: number; status: string; notes: string; provenance?: 'AI_EXTRACTED' | 'USER_CORRECTED' | 'UNVERIFIED' };
    surveyNumber: { value: string; marathi: string; confidence: number; status: string; notes: string; provenance?: 'AI_EXTRACTED' | 'USER_CORRECTED' | 'UNVERIFIED' };
    subDivision: { value: string; marathi: string; confidence: number; status: string; notes: string; provenance?: 'AI_EXTRACTED' | 'USER_CORRECTED' | 'UNVERIFIED' };
    totalArea: { value: string; marathi: string; confidence: number; status: string; notes: string; provenance?: 'AI_EXTRACTED' | 'USER_CORRECTED' | 'UNVERIFIED' };
    shareFraction: { value: string; marathi: string; confidence: number; status: string; notes: string; warning?: boolean; provenance?: 'AI_EXTRACTED' | 'USER_CORRECTED' | 'UNVERIFIED' };
    encumbrances: { value: string; marathi: string; confidence: number; status: string; notes: string; warning?: boolean; provenance?: 'AI_EXTRACTED' | 'USER_CORRECTED' | 'UNVERIFIED' };
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

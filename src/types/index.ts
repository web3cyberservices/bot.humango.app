
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Category = 'ADA' | 'GDPR' | 'Privacy' | 'Security' | 'AI' | 'Transactional' | 'HR_Edu' | 'Legal_Content' | 'IMPRESSUM' | 'LEGAL_GROUNDS';
export type ScanType = 'basic' | 'deep';
export type ReportType = 'SaaS' | 'Manual';
export type VerificationMethod = 'Static Analysis' | 'Dynamic Emulation';

export interface Violation {
  id?: number;
  category: Category;
  issue_type: string;
  severity: Severity;
  evidence_html: string; 
  evidence_quote?: string;
  confidence_score: number;
  snippet?: string;
  description: string;
  business_impact: string;
  explanation: string;
  law_name: string;        
  potential_fine: string;  
  recommendation: string;
  scan_type?: ScanType;
  report_type: ReportType;
  affected_urls?: string[];
  verification_method?: VerificationMethod;
}

export interface ComplianceReport {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  verdict: 'COMPLIANT' | 'RISKY';
  jurisdiction?: string;
  top_risks: string[];
  validation_status: 'verified' | 'incomplete' | 'suspicious';
  nav_scout: {
    found_links: string[];
    missing_critical: string[];
    discovery_score: number;
  };
  lex_analyzer: {
    has_vat_id: boolean;
    has_contact_info: boolean;
    has_mandatory_terms: boolean;
    content_truncated: boolean;
    missing_clusters: string[];
  };
  cmp_detect: {
    detected_provider: string | null;
    is_active: boolean;
  };
}

export interface CrawlResult {
  url: string;
  timestamp: string;
  status: 'success' | 'failed' | 'blocked' | 'skipped';
  issuesFound: number;
  violations?: Violation[];
  compliance_report?: ComplianceReport;
  scanType: ScanType;
  error?: string;
  reason?: string;
  discoveredLinks?: string[];
  meta?: {
    duration_ms: number;
    memory_usage_mb: number;
    method: 'fetch' | 'puppeteer';
    verification_method: VerificationMethod;
    hasCMP: boolean;
    legal_links: Record<string, string | null>;
    attempts: number;
  };
}

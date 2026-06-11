export interface RTPStream {
  ssrc: string;
  source_ip: string;
  destination_ip: string;
  source_port: number;
  destination_port: number;
  packet_count: number;
  lost_packets: number;
  packet_loss_percent: number;
  jitter_ms: number;
  gaps: number;
  codec: string;
}

export interface CallFlowEvent {
  time_ms: number;
  source: string;
  destination: string;
  info: string;
}

export interface NatIssues {
  rtp_source_mismatch: boolean;
  private_public_mismatch: boolean;
  possible_nat_traversal_issues: boolean;
}

export interface SIPStats {
  methods: Record<string, number>;
  responses: Record<string, number>;
  call_attempts: number;
  successful_calls: number;
  failed_calls: number;
  registration_attempts: number;
  registration_failures: number;
  authentication_failures: number;
}

export interface PcapSummary {
  call_count: number;
  successful_calls: number;
  failed_calls: number;
  avg_call_setup_ms: number;
  avg_call_duration_sec: number;
  packet_loss_percent: number;
  avg_jitter_ms: number;
  codecs: string[];
  detected_issues: string[];
  rtp_streams: RTPStream[];
  stun_packets_count: number;
  turn_packets_count: number;
  webrtc_packets_count: number;
  websocket_sip_count: number;
  call_quality_score: number;
  media_stability_score: number;
  nat_issues: NatIssues;
  sip_stats: SIPStats;
  call_flow_ladder: CallFlowEvent[];
}

export interface AiAnalysis {
  overall_health: string; // "Good" | "Fair" | "Critical"
  call_quality_score: number;
  root_causes: string[];
  critical_findings: string[];
  detected_issues: string[];
  recommendations: string[];
  executive_summary: string;
}

export interface LogRootCause {
  issue: string;
  confidence: number;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface LogAiAnalysis {
  executive_summary: string;
  overall_health: "Good" | "Warning" | "Critical";
  root_causes: LogRootCause[];
  incident_timeline: string[];
  affected_services: string[];
  health_scores: {
    sip: number;
    media: number;
    carrier: number;
    database: number;
  };
  critical_findings: string[];
  recommendations: {
    immediate_actions: string[];
    long_term_actions: string[];
  };
}

export interface LogEntry {
  line_number: number;
  timestamp: string | null;
  severity: "error" | "warning" | "info";
  categories: string[];
  message: string;
}

export interface LogSummary {
  platform: string;
  error_count: number;
  warning_count: number;
  registration_failures: number;
  authentication_failures: number;
  network_errors: number;
  rtp_errors: number;
  codec_errors: number;
  gateway_errors: number;
  trunk_errors: number;
  call_failures: number;
  timeouts: number;
  sip_errors: Record<string, number>;
  top_errors: string[];
  line_count: number;
  detected_issues: string[];
  matched_lines?: LogEntry[];
  call_flow_ladder?: CallFlowEvent[];
}

export interface UnifiedAnalysisResult {
  pcap_summary?: PcapSummary;
  log_summary?: LogSummary;
  ai_analysis: AiAnalysis | LogAiAnalysis;
}

export type JobType = "pcap" | "log";

export interface Job {
  job_id: string;
  job_type: JobType;
  status: "queued" | "processing" | "completed" | "failed";
  filename: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatHistoryResponse {
  session_id: string;
  suggested_questions: string[];
  history: ChatMessage[];
}

export interface ChatRequest {
  message: string;
  mode: "beginner" | "intermediate" | "expert";
}

export interface ChatResponse {
  response: string;
}

import React, { useState, useMemo } from "react";
import { 
  ShieldAlert, 
  AlertTriangle, 
  Activity, 
  CheckCircle2, 
  FileText, 
  Clock, 
  Search, 
  ListFilter, 
  ClipboardList, 
  Server, 
  CheckSquare, 
  Shield, 
  Database,
  Layers,
  ChevronRight,
  ArrowRightLeft
} from "lucide-react";
import { LogAiAnalysis, LogSummary, LogEntry } from "../types";
import CallFlowLadder from "./CallFlowLadder";

interface Props {
  analysis: LogAiAnalysis;
  logSummary?: LogSummary;
}

export default function LogAnalysisReport({ analysis, logSummary }: Props) {
  const [activeTab, setActiveTab] = useState<"diagnostics" | "timeline" | "remediation" | "console" | "flow">("diagnostics");
  
  // Log viewer filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | "error" | "warning" | "info">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  if (!analysis) return null;

  // Extract matched lines from log summary
  const matchedLines = logSummary?.matched_lines || [];

  // Compute all unique categories dynamically for filter dropdown
  const uniqueCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    matchedLines.forEach(line => {
      line.categories?.forEach(cat => categoriesSet.add(cat));
    });
    return Array.from(categoriesSet);
  }, [matchedLines]);

  // Client-side filtering logic for the log viewer
  const filteredLines = useMemo(() => {
    return matchedLines.filter(line => {
      const matchesSearch = line.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (line.timestamp && line.timestamp.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            line.line_number.toString().includes(searchTerm);
      
      const matchesSeverity = severityFilter === "all" || line.severity === severityFilter;
      
      const matchesCategory = categoryFilter === "all" || line.categories?.includes(categoryFilter);

      return matchesSearch && matchesSeverity && matchesCategory;
    });
  }, [matchedLines, searchTerm, severityFilter, categoryFilter]);

  // Helpers for formatting health badges
  const getHealthBadge = (health: string) => {
    switch (health?.toLowerCase()) {
      case "good":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Good Health
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Warning
          </span>
        );
      case "critical":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-450 border border-rose-500/20 animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5" />
            Critical Status
          </span>
        );
    }
  };

  // Severity Level Badge styling for Root Causes
  const getSeverityBadge = (sev: string) => {
    const s = sev?.toUpperCase();
    if (s === "CRITICAL") {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/10 text-red-500 border border-red-500/20">CRITICAL</span>;
    } else if (s === "HIGH") {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-orange-500/10 text-orange-500 border border-orange-500/20">HIGH</span>;
    } else if (s === "MEDIUM") {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">MEDIUM</span>;
    } else if (s === "LOW") {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">LOW</span>;
    } else {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">INFO</span>;
    }
  };

  // Health Score color helper
  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500 text-emerald-450";
    if (score >= 50) return "bg-amber-500 text-amber-500";
    return "bg-rose-500 text-rose-450";
  };

  return (
    <div className="space-y-6">
      
      {/* Platform & General Info Summary Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">VoIP System Engine</span>
              {getHealthBadge(analysis.overall_health)}
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">
              Platform: {logSummary?.platform || "Unknown Platform"}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono text-slate-600">
          <div className="text-center">
            <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">Total Lines</span>
            <strong className="text-sm font-bold text-slate-800">{logSummary?.line_count ?? 0}</strong>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="text-center">
            <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-0.5 text-rose-600">Errors</span>
            <strong className="text-sm font-bold text-rose-600">{logSummary?.error_count ?? 0}</strong>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="text-center">
            <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-0.5 text-amber-600">Warnings</span>
            <strong className="text-sm font-bold text-amber-600">{logSummary?.warning_count ?? 0}</strong>
          </div>
        </div>
      </div>

      {/* Advanced Diagnostics Tab Navigation */}
      <div className="flex items-center border-b border-slate-200 bg-white px-2 rounded-lg border shadow-sm sticky top-16 z-30">
        <button
          onClick={() => setActiveTab("diagnostics")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider font-mono border-b-2 transition-all ${
            activeTab === "diagnostics"
              ? "border-emerald-500 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Activity className="w-4 h-4" />
          Root Cause & Diagnostics
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider font-mono border-b-2 transition-all ${
            activeTab === "timeline"
              ? "border-emerald-500 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Clock className="w-4 h-4" />
          Chronological Timeline
        </button>
        <button
          onClick={() => setActiveTab("remediation")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider font-mono border-b-2 transition-all ${
            activeTab === "remediation"
              ? "border-emerald-500 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Action & Remediation Plan
        </button>
        <button
          onClick={() => setActiveTab("flow")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider font-mono border-b-2 transition-all ${
            activeTab === "flow"
              ? "border-emerald-500 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          SIP Call Flow
          {logSummary?.call_flow_ladder && logSummary.call_flow_ladder.length > 0 && (
            <span className="ml-1 text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full border border-slate-200">
              {logSummary.call_flow_ladder.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("console")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider font-mono border-b-2 transition-all ${
            activeTab === "console"
              ? "border-emerald-500 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText className="w-4 h-4" />
          Interactive Log Console
          {matchedLines.length > 0 && (
            <span className="ml-1 text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full border border-slate-200">
              {matchedLines.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">

        {/* Tab 1: Root Cause & Diagnostics */}
        {activeTab === "diagnostics" && (
          <div className="space-y-6">
            
            {/* Infrastructure Health Scores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {analysis.health_scores && Object.entries(analysis.health_scores).map(([layer, score]) => {
                const scoreColor = getHealthScoreColor(score);
                const scoreNum = score ?? 100;
                return (
                  <div key={layer} className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      <span>{layer} layer health</span>
                      {layer === "sip" ? <Server className="w-3.5 h-3.5 text-blue-400" /> :
                       layer === "media" ? <Layers className="w-3.5 h-3.5 text-indigo-400" /> :
                       layer === "carrier" ? <Shield className="w-3.5 h-3.5 text-orange-400" /> :
                       <Database className="w-3.5 h-3.5 text-sky-400" />}
                    </div>
                    <div className="flex items-baseline gap-1 mt-3">
                      <span className="text-2xl font-bold font-mono text-slate-900">{scoreNum}</span>
                      <span className="text-slate-400 text-xs font-mono">/100</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
                      <div className={`h-full ${scoreColor.split(" ")[0]}`} style={{ width: `${scoreNum}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Executive Summary */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm border-l-4 border-l-emerald-500">
              <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-450" />
                Executive Summary
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed text-justify font-medium italic">
                "{analysis.executive_summary}"
              </p>
            </div>

            {/* Root Cause & Correlation analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Correlation & Rank List */}
              <div className="lg:col-span-2 bg-white p-5 border border-slate-200 rounded-xl shadow-sm space-y-4">
                <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2.5 flex items-center justify-between">
                  <span>Root Cause Correlation & Ranking</span>
                  <span className="text-[10px] text-slate-400">Sorted by Confidence</span>
                </h3>
                
                <div className="space-y-3">
                  {analysis.root_causes && analysis.root_causes.length > 0 ? (
                    analysis.root_causes.map((rc, idx) => (
                      <div key={idx} className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded bg-slate-200 text-slate-700 text-xs font-mono font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-800 leading-tight">
                              {rc.issue}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {getSeverityBadge(rc.severity)}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pt-1 text-[10px] font-mono text-slate-500">
                          <span className="font-semibold text-slate-600">Confidence Match:</span>
                          <div className="flex-grow bg-slate-200 h-2 rounded-full overflow-hidden max-w-[150px]">
                            <div className="h-full bg-emerald-500" style={{ width: `${rc.confidence}%` }} />
                          </div>
                          <span>{rc.confidence}%</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-500 italic">No correlation findings detected.</div>
                  )}
                </div>
              </div>

              {/* Service Impact & Findings */}
              <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm space-y-5">
                <div>
                  <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2.5 mb-3">
                    Affected Services
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.affected_services && analysis.affected_services.length > 0 ? (
                      analysis.affected_services.map((service, idx) => (
                        <span 
                          key={idx} 
                          className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-rose-500/10 text-rose-600 border border-rose-500/15"
                        >
                          {service}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 italic">No business service impact mapped.</span>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2.5 mb-3">
                    Critical Findings
                  </h3>
                  <ul className="space-y-2">
                    {analysis.critical_findings && analysis.critical_findings.length > 0 ? (
                      analysis.critical_findings.map((finding, idx) => (
                        <li key={idx} className="flex gap-2 text-xs text-slate-700 leading-normal">
                          <span className="text-rose-500 font-bold">•</span>
                          <span>{finding}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-slate-500 italic">No critical anomalies registered.</li>
                    )}
                  </ul>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Tab 2: Chronological incident timeline */}
        {activeTab === "timeline" && (
          <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
            <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-3 mb-6 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-450" />
              Reconstructed Incident Timeline
            </h3>

            <div className="relative pl-6 border-l border-slate-200 space-y-6 ml-3">
              {analysis.incident_timeline && analysis.incident_timeline.length > 0 ? (
                analysis.incident_timeline.map((event, idx) => {
                  // Attempt to parse out time and message (e.g. "12:01:03 Registration Failed")
                  const parts = event.split(" ");
                  const potentialTime = parts[0]?.match(/^\d{2}:\d{2}:\d{2}/) ? parts[0] : "";
                  const eventMsg = potentialTime ? parts.slice(1).join(" ") : event;

                  return (
                    <div key={idx} className="relative group">
                      {/* Outer timeline indicator */}
                      <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 border border-emerald-500 ring-4 ring-white z-10 transition-transform group-hover:scale-125">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      </span>
                      
                      <div className="bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          {potentialTime && (
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-bold mr-2 mb-1.5 sm:mb-0">
                              {potentialTime}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-slate-800 leading-normal">
                            {eventMsg}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          Step #{idx + 1}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-xs text-slate-500 italic">No timeline entries generated.</div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Action & Remediation Plan */}
        {activeTab === "remediation" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Immediate Action Items */}
            <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm space-y-4">
              <h3 className="text-xs font-mono text-rose-500 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Immediate Actions
              </h3>
              
              <div className="space-y-2.5">
                {analysis.recommendations?.immediate_actions && analysis.recommendations.immediate_actions.length > 0 ? (
                  analysis.recommendations.immediate_actions.map((act, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3.5 bg-rose-50/30 border border-rose-500/10 rounded-lg hover:bg-rose-50/50 transition-colors">
                      <div className="p-1 px-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 text-[10px] font-mono font-bold leading-none">
                        ACT {idx + 1}
                      </div>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">{act}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 italic">No immediate operations suggested.</div>
                )}
              </div>
            </div>

            {/* Long Term Preventive Actions */}
            <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm space-y-4">
              <h3 className="text-xs font-mono text-blue-600 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-blue-500" />
                Long-Term Mitigation
              </h3>
              
              <div className="space-y-2.5">
                {analysis.recommendations?.long_term_actions && analysis.recommendations.long_term_actions.length > 0 ? (
                  analysis.recommendations.long_term_actions.map((act, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3.5 bg-blue-50/30 border border-blue-500/10 rounded-lg hover:bg-blue-50/50 transition-colors">
                      <div className="p-1 px-2 rounded bg-blue-500/10 border border-blue-500/20 text-blue-600 text-[10px] font-mono font-bold leading-none">
                        PLAN {idx + 1}
                      </div>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">{act}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 italic">No long term maintenance actions generated.</div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Tab 4: Interactive Log Console */}
        {activeTab === "console" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[550px]">
            
            {/* Filter Toolbar */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
              
              {/* Search Box */}
              <div className="relative w-full md:max-w-xs">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search log lines..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Status and Category dropdowns */}
              <div className="flex gap-2.5 w-full md:w-auto">
                
                {/* Severity Dropdown */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 w-full md:w-auto">
                  <ListFilter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={severityFilter}
                    onChange={(e: any) => setSeverityFilter(e.target.value)}
                    className="bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="all">Severity: All</option>
                    <option value="error">Errors Only</option>
                    <option value="warning">Warnings Only</option>
                    <option value="info">Info/Other</option>
                  </select>
                </div>

                {/* Category Dropdown */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 w-full md:w-auto">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-transparent focus:outline-none cursor-pointer max-w-[180px] truncate"
                  >
                    <option value="all">Category: All</option>
                    {uniqueCategories.map(cat => (
                      <option key={cat} value={cat}>{cat.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>

              </div>
            </div>

            {/* Terminal Log Console */}
            <div className="flex-1 bg-slate-950 text-slate-300 font-mono text-xs overflow-y-auto p-4 custom-scrollbar">
              {filteredLines.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 font-sans">
                  <FileText className="w-8 h-8 text-slate-600" />
                  <p className="text-xs">No matching log records found in file.</p>
                  <p className="text-[10px] text-slate-700">Refine your search parameters and filters.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredLines.map((line, idx) => {
                    const isError = line.severity === "error";
                    const isWarning = line.severity === "warning";
                    
                    return (
                      <div key={idx} className="flex items-start gap-4 hover:bg-slate-900/60 py-0.5 rounded px-1 group">
                        
                        {/* Line number */}
                        <span className="w-10 text-right text-slate-600 text-[10px] select-none select-none pr-1 border-r border-slate-800">
                          {line.line_number}
                        </span>

                        {/* Timestamp */}
                        {line.timestamp && (
                          <span className="text-cyan-500 text-[10px] select-none whitespace-nowrap">
                            {line.timestamp}
                          </span>
                        )}

                        {/* Severity tag */}
                        <span className="select-none flex-shrink-0 w-16 text-[9px] uppercase font-bold text-center">
                          {isError ? (
                            <span className="text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/20">ERROR</span>
                          ) : isWarning ? (
                            <span className="text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20">WARNING</span>
                          ) : (
                            <span className="text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded border border-blue-500/20">INFO</span>
                          )}
                        </span>

                        {/* Log message body */}
                        <span className="text-slate-200 break-all select-text flex-grow">
                          {line.message}
                          
                          {/* Inline categories badges inside viewer */}
                          {line.categories && line.categories.length > 0 && (
                            <span className="ml-2 inline-flex gap-1">
                              {line.categories.map(cat => (
                                <span key={cat} className="text-[8px] bg-slate-800 text-slate-400 px-1 rounded font-sans leading-none uppercase">
                                  {cat.replace("_", " ")}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Terminal Footer Info */}
            <div className="bg-slate-900 border-t border-slate-850 p-2 px-4 flex justify-between items-center text-[10px] font-mono text-slate-500 select-none">
              <span>Filtered: {filteredLines.length} of {matchedLines.length} events</span>
              <span>Visual Console v1.0.0</span>
            </div>
          </div>
        )}

        {activeTab === "flow" && (
          <CallFlowLadder events={logSummary?.call_flow_ladder || []} />
        )}

      </div>
    </div>
  );
}

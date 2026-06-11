import React, { useState, useEffect, useRef } from "react";
import { 
  Activity, 
  UploadCloud, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RotateCw, 
  Network, 
  ArrowRightLeft, 
  Volume2, 
  Sliders,
  ShieldCheck,
  RefreshCw
} from "lucide-react";

import { Job, UnifiedAnalysisResult } from "./types";
import CallFlowLadder from "./components/CallFlowLadder";
import AiAnalysisReport from "./components/AiAnalysisReport";
import LogAnalysisReport from "./components/LogAnalysisReport";

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [activeResult, setActiveResult] = useState<UnifiedAnalysisResult | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"ai" | "ladder" | "streams">("ai");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/v1/jobs");
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
      }
    } catch (e) {
      console.error("Error fetching jobs list:", e);
    }
  };

  useEffect(() => {
    fetchJobs();
    
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeJob && (activeJob.status === "queued" || activeJob.status === "processing")) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      
      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/v1/jobs/${activeJob.job_id}`);
          if (res.ok) {
            const updatedJob: Job = await res.json();
            
            setActiveJob(updatedJob);
            
            setJobs(prevJobs => 
              prevJobs.map(j => j.job_id === updatedJob.job_id ? { ...j, status: updatedJob.status } : j)
            );

            if (updatedJob.status === "completed") {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              fetchResult(updatedJob.job_id, updatedJob.job_type);
            } else if (updatedJob.status === "failed") {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            }
          }
        } catch (e) {
          console.error("Polling status error:", e);
        }
      }, 2000);
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }, [activeJob]);

  const fetchResult = async (jobId: string, jobType: Job["job_type"]) => {
    setIsLoadingResult(true);
    try {
      const endpoint = jobType === "log" ? `/api/v1/logs/results/${jobId}` : `/api/v1/results/${jobId}`;
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          setActiveResult(data.result);
        } else {
          setActiveResult(null);
        }
      }
    } catch (e) {
      console.error("Error retrieving analysis details:", e);
    } finally {
      setIsLoadingResult(false);
    }
  };

  const handleSelectJob = (job: Job) => {
    setActiveJob(job);
    setActiveResult(null);
    if (job.status === "completed") {
      fetchResult(job.job_id, job.job_type);
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    
    const formData = new FormData();
    formData.append("file", file);

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const endpoint = [".log", ".txt"].includes(ext) ? "/api/v1/logs/upload" : "/api/v1/upload";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errMsg = await response.json();
        throw new Error(errMsg.detail || "Failed to submit PCAP trace to engine.");
      }

      const jobResponse: Job = await response.json();
      
      setJobs(prev => [jobResponse, ...prev]);
      setActiveJob(jobResponse);
      setActiveResult(null);
      setActiveTab("ai");
    } catch (e: any) {
      setUploadError(e.message || "An unexpected communication error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      uploadFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const renderStatusBadge = (status: Job["status"]) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            completed
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <RotateCw className="w-3 h-3 animate-spin" />
            processing
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-450 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            failed
          </span>
        );
      case "queued":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-neutral-805 text-neutral-400 border border-neutral-800">
            <Clock className="w-3 h-3" />
            queued
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans select-none antialiased">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 shadow-sm animate-pulse">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              VoIP AI Analyzer
              <span className="text-[10px] font-mono text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/15">
                v1.0.0
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Production-ready PCAP SIP parser & Large Language Model diagnostic panel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={fetchJobs}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-neutral-800 rounded-lg transition-all"
            title="Refresh history"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
        
        <aside className="lg:col-span-1 border-r border-slate-200 bg-slate-50 p-5 flex flex-col gap-6 overflow-y-auto">
          
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest font-mono">
              Upload Signal Trace
            </h2>
            
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleBrowseClick}
              className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging 
                  ? "border-emerald-500 bg-emerald-500/5 text-emerald-400" 
                  : "border-slate-300 hover:border-slate-400 bg-slate-100/80 hover:bg-slate-200"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pcap,.pcapng,.cap,.log,.txt"
                className="hidden"
                onChange={handleFileChange}
              />

              {isUploading ? (
                <div className="space-y-2">
                  <RotateCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-xs font-medium text-slate-700">Uploading trace data...</p>
                  <p className="text-[10px] text-slate-500">FastAPI processing background queue</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <UploadCloud className={`w-8 h-8 mx-auto transition-colors ${isDragging ? 'text-emerald-400' : 'text-neutral-500'}`} />
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      Drag & Drop PCAP or VoIP log file
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Supports .pcap, .pcapng, .cap, .log, and .txt
                    </p>
                  </div>
                  <button className="px-3 py-1.5 bg-white text-slate-900 hover:text-slate-900 border border-slate-300 hover:border-slate-400 rounded-lg text-[11px] font-medium transition-all mx-auto shadow-sm">
                    Browse Files
                  </button>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg relative text-xs text-rose-400 flex gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-[11px] leading-tight mb-0.5">Upload Failed</h4>
                  <p className="text-[10px] text-rose-300 leading-normal">{uploadError}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-2 min-h-[300px]">
            <h2 className="text-xs font-bold text-slate-600 uppercase tracking-widest font-mono flex items-center justify-between">
              Analysis History
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 border border-slate-200 rounded">
                {jobs.length} total
              </span>
            </h2>

            <div className="flex-grow overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {jobs.length === 0 ? (
                <div className="text-center p-8 border border-slate-200 bg-slate-100 rounded-xl space-y-1.5 mt-2">
                  <Clock className="w-5 h-5 text-neutral-600 mx-auto" />
                  <p className="text-xs font-medium text-neutral-500">No uploads recorded yet.</p>
                  <p className="text-[10px] text-neutral-600">Simulate by dropping any file</p>
                </div>
              ) : (
                jobs.map((job) => {
                  const isActive = activeJob?.job_id === job.job_id;
                  return (
                    <div
                      key={job.job_id}
                      onClick={() => handleSelectJob(job)}
                      className={`p-3.5 border rounded-xl cursor-pointer transition-all flex flex-col gap-2 ${
                        isActive
                          ? "border-emerald-500/50 bg-emerald-50 shadow-sm shadow-emerald-500/10"
                          : "border-slate-200 hover:border-slate-300 bg-slate-100/70 hover:bg-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate text-xs font-semibold text-slate-900" title={job.filename}>
                          {job.filename}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500">
                            {job.job_type.toUpperCase()}
                          </span>
                          {renderStatusBadge(job.status)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>+ {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span className="opacity-60">{job.job_id.substring(0, 8)}...</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        <main className="lg:col-span-3 bg-slate-50 p-6 overflow-y-auto flex flex-col gap-6">
          
          {!activeJob ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center max-w-xl mx-auto space-y-6">
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-400">
                <Network className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  VoIP PCAP Analytics Engine Online
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  We specialize in SIP signal flows and RTP media analysis. Upload a packet capture file (or click one from the history panel) to audit call setup quality, inspect NAT traversal errors, find stream interruptions, and generate AI-powered root-cause reports instantly.
                </p>
              </div>

              <div className="p-4 border border-slate-200 bg-slate-100 rounded-xl w-full flex items-center justify-between text-left">
                <div>
                  <h4 className="text-xs font-bold text-emerald-600 font-mono uppercase tracking-wider">
                    Quick Simulation Check
                  </h4>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    Don't have a PCAP file? Drop a text / blank file to load standard simulation data.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    const file = new File(["dummy voip data"], "simulation_trace.pcap", { type: "application/octet-stream" });
                    uploadFile(file);
                  }}
                  className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg hover:bg-emerald-500/20 transition-all font-mono whitespace-nowrap"
                >
                  Load Demo Trace
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 flex-grow flex flex-col">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-600">Active Audit Trace:</span>
                    <h2 className="text-sm font-bold text-slate-900 font-mono truncate max-w-xs" title={activeJob.filename}>
                      {activeJob.filename}
                    </h2>
                    {renderStatusBadge(activeJob.status)}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    Session UID: {activeJob.job_id} | Timestamps: {new Date(activeJob.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-700 bg-slate-100 px-3 py-1.5 border border-slate-300 rounded-lg">
                    State:{" "}
                    <strong className="text-slate-900 capitalize">{activeJob.status}</strong>
                  </span>
                </div>
              </div>

              {activeJob.status === "failed" && (
                <div className="p-5 border border-rose-500/20 bg-rose-500/5 rounded-xl space-y-2">
                  <h3 className="text-sm font-bold text-rose-450 uppercase tracking-widest font-mono flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    Background Job Execution Failure
                  </h3>
                  <p className="text-xs text-rose-300 leading-normal">
                    The background packet analyzer failed to compile statistics for this upload. Details on error:
                  </p>
                  <pre className="p-3 bg-slate-950 border border-slate-200 rounded-md text-[10px] font-mono text-rose-300 overflow-x-auto whitespace-pre-wrap">
                    {activeJob.error_message || "Unknown SQLite internal parsing exception."}
                  </pre>
                  <div className="text-[10px] text-slate-600 mt-1">
                    * Ensure the file is of standard Wireshark capture format (`.pcap`, `.pcapng`).
                  </div>
                </div>
              )}

              {activeJob.status !== "completed" && activeJob.status !== "failed" && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                  <RotateCw className="w-10 h-10 text-amber-500 animate-spin" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900">
                      Processing Background Waveforms
                    </h3>
                    <p className="text-xs text-slate-600 max-w-xs">
                      Scapy is parsing UDP headers, mapping SIP methods, calculating RTP sequential Jitter numbers, and querying LLM context.
                    </p>
                  </div>
                  <div className="text-[10px] font-mono text-amber-500/70 bg-amber-500/5 px-3 py-1 border border-amber-500/10 rounded-full">
                    Polling Job Node status every 2 seconds...
                  </div>
                </div>
              )}

              {activeJob.status === "completed" && (
                <>
                  {isLoadingResult ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
                        <RotateCw className="w-8 h-8 text-slate-500 animate-spin" />
                        <p className="text-xs text-slate-500 font-mono">Retrieving results cached in SQLite DB...</p>
                    </div>
                  ) : activeResult ? (
                    activeJob?.job_type === "log" ? (
                      <div className="space-y-6 flex-grow">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono mb-2">Platform</p>
                            <p className="text-sm font-semibold text-slate-900">{activeResult.log_summary?.platform || "Unknown"}</p>
                          </div>
                          <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono mb-2">Errors</p>
                            <p className="text-sm font-semibold text-slate-900">{activeResult.log_summary?.error_count ?? 0}</p>
                          </div>
                          <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono mb-2">Warnings</p>
                            <p className="text-sm font-semibold text-slate-900">{activeResult.log_summary?.warning_count ?? 0}</p>
                          </div>
                          <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono mb-2">Detected Issues</p>
                            <p className="text-sm font-semibold text-slate-900">{activeResult.log_summary?.detected_issues?.length ?? 0}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="bg-slate-100 p-5 border border-slate-200 rounded-xl">
                            <h3 className="text-sm font-semibold text-slate-900 mb-3">Top Log Events</h3>
                            <ul className="space-y-2 text-xs text-slate-700">
                              {activeResult.log_summary?.top_errors?.length ? (
                                activeResult.log_summary.top_errors.map((item, idx) => (
                                  <li key={idx} className="rounded-lg px-3 py-2 bg-white border border-slate-200">{item}</li>
                                ))
                              ) : (
                                <li className="rounded-lg px-3 py-2 bg-white border border-slate-200">No top events identified.</li>
                              )}
                            </ul>
                          </div>

                          <div className="bg-slate-100 p-5 border border-slate-200 rounded-xl">
                            <h3 className="text-sm font-semibold text-slate-900 mb-3">SIP Code Summary</h3>
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                              {activeResult.log_summary?.sip_errors && Object.entries(activeResult.log_summary.sip_errors).map(([code, count]) => (
                                <div key={code} className="rounded-lg px-3 py-2 bg-white border border-slate-200 flex items-center justify-between">
                                  <span>{code}</span>
                                  <strong>{count}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <LogAnalysisReport analysis={activeResult.ai_analysis as any} />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6 flex-grow">
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        
                        <div className="bg-white p-4 border border-slate-200 rounded-xl relative overflow-hidden shadow-sm">
                          <div className="flex justify-between items-start mb-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                            <span>Call Quality Score</span>
                            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div className="flex items-baseline gap-1 mt-2">
                            <span className="text-2xl font-bold font-mono text-neutral-100">
                              {activeResult.pcap_summary!.call_quality_score}
                            </span>
                            <span className="text-neutral-550 text-xs text-mono">/100</span>
                          </div>
                          <div className="w-full bg-neutral-950 h-1 rounded overflow-hidden mt-3">
                            <div 
                              className={`h-full ${
                                activeResult.pcap_summary!.call_quality_score >= 80 
                                  ? 'bg-emerald-500' 
                                  : activeResult.pcap_summary!.call_quality_score >= 50 
                                    ? 'bg-amber-500' 
                                    : 'bg-rose-500'
                              }`}
                              style={{ width: `${activeResult.pcap_summary!.call_quality_score}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="bg-neutral-900 p-4 border border-neutral-850 rounded-xl">
                          <div className="flex justify-between items-start mb-1 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                            <span>Media Stability</span>
                            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                          </div>
                          <div className="flex items-baseline gap-1 mt-2">
                            <span className="text-2xl font-bold font-mono text-neutral-100">
                              {activeResult.pcap_summary!.media_stability_score}
                            </span>
                            <span className="text-neutral-550 text-xs text-mono">/100</span>
                          </div>
                          <div className="w-full bg-neutral-950 h-1 rounded overflow-hidden mt-3">
                            <div 
                              className="h-full bg-sky-500"
                              style={{ width: `${activeResult.pcap_summary!.media_stability_score}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="bg-neutral-900 p-4 border border-neutral-850 rounded-xl">
                          <div className="flex justify-between items-start mb-1 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                            <span>Packet Loss</span>
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          </div>
                          <div className="flex items-baseline gap-1 mt-2">
                            <span className={`text-2xl font-bold font-mono ${activeResult.pcap_summary!.packet_loss_percent > 5.0 ? 'text-rose-400 animate-pulse' : 'text-neutral-100'}`}>
                              {activeResult.pcap_summary!.packet_loss_percent}%
                            </span>
                          </div>
                          <p className="text-[9px] font-mono text-neutral-550 mt-3 uppercase tracking-wider">
                            Allowed Limit &lt; 5.0%
                          </p>
                        </div>

                        <div className="bg-neutral-900 p-4 border border-neutral-850 rounded-xl">
                          <div className="flex justify-between items-start mb-1 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                            <span>Average Jitter</span>
                            <Volume2 className="w-3.5 h-3.5 text-orange-400" />
                          </div>
                          <div className="flex items-baseline gap-1 mt-2">
                            <span className={`text-2xl font-bold font-mono ${activeResult.pcap_summary!.avg_jitter_ms > 30 ? 'text-rose-400 animate-pulse' : 'text-neutral-100'}`}>
                              {activeResult.pcap_summary!.avg_jitter_ms}
                            </span>
                            <span className="text-neutral-550 text-xs text-mono">ms</span>
                          </div>
                          <p className="text-[9px] font-mono text-neutral-550 mt-3 uppercase tracking-wider">
                            Target Threshold &lt; 30ms
                          </p>
                        </div>

                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-neutral-900/60 border border-neutral-850 rounded-xl flex items-center gap-4">
                          <Volume2 className="w-8 h-8 text-neutral-500 opacity-60" />
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block">
                              Negotiated Codecs
                            </span>
                            <div className="flex gap-1.5 flex-wrap">
                              {activeResult.pcap_summary!.codecs.map((codec, id) => (
                                <span key={id} className="text-xs font-mono font-bold bg-neutral-950 px-2 py-0.5 border border-neutral-800 rounded">
                                  {codec}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-neutral-900/60 border border-neutral-850 rounded-xl flex items-center gap-4">
                          <Network className="w-8 h-8 text-neutral-500 opacity-60" />
                          <div className="space-y-0.5 flex-grow">
                            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block">
                              NAT Traversal Check
                            </span>
                            <div className="flex items-center justify-between text-xs font-mono">
                              {activeResult.pcap_summary!.nat_issues.possible_nat_traversal_issues ? (
                                <span className="text-amber-400 font-semibold flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Potential NAT traversal problem
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Clean NAT profiles
                                </span>
                              )}
                              <span className="text-[10px] text-neutral-500">
                                Public/Private IP mapping
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center border-b border-neutral-850 bg-neutral-950 sticky top-16 z-30 py-1 gap-2">
                        <button
                          onClick={() => setActiveTab("ai")}
                          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider font-mono border-b-2 transition-all ${
                            activeTab === "ai"
                              ? "border-emerald-500 text-emerald-400"
                              : "border-transparent text-neutral-500 hover:text-neutral-300"
                          }`}
                        >
                          AI Diagnostics
                        </button>
                        <button
                          onClick={() => setActiveTab("ladder")}
                          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider font-mono border-b-2 transition-all ${
                            activeTab === "ladder"
                              ? "border-emerald-500 text-emerald-400"
                              : "border-transparent text-neutral-500 hover:text-neutral-300"
                          }`}
                        >
                          SIP Call Flow
                        </button>
                        <button
                          onClick={() => setActiveTab("streams")}
                          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider font-mono border-b-2 transition-all ${
                            activeTab === "streams"
                              ? "border-emerald-500 text-emerald-400"
                              : "border-transparent text-neutral-500 hover:text-neutral-300"
                          }`}
                        >
                          RTP & Protocol Statistics
                        </button>
                      </div>

                      <div className="space-y-4">
                        
                        {activeTab === "ai" && (
                          <AiAnalysisReport analysis={activeResult.ai_analysis as any} />
                        )}

                        {activeTab === "ladder" && (
                          <CallFlowLadder events={activeResult.pcap_summary!.call_flow_ladder} />
                        )}

                        {activeTab === "streams" && (
                          <div className="space-y-6">
                            <div className="bg-neutral-950 p-5 border border-neutral-800 rounded-xl space-y-4">
                              <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest font-mono flex items-center gap-2">
                                <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
                                Decoded SSRC RTP Streams
                              </h3>

                              <div className="overflow-x-auto border border-neutral-900 rounded-lg">
                                <table className="w-full text-left border-collapse text-xs font-mono">
                                  <thead>
                                    <tr className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 font-semibold">
                                      <th className="p-3">SSRC Block</th>
                                      <th className="p-3">Source IP & Port</th>
                                      <th className="p-3">Destination IP & Port</th>
                                      <th className="p-3 text-right">Packets</th>
                                      <th className="p-3 text-right">Loss Rate</th>
                                      <th className="p-3 text-right">Jitter</th>
                                      <th className="p-3 text-center">Codec</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-neutral-900 text-neutral-300">
                                    {activeResult.pcap_summary!.rtp_streams.map((stream, idx) => (
                                      <tr key={idx} className="hover:bg-neutral-900/40">
                                        <td className="p-3 font-semibold text-emerald-400">{stream.ssrc}</td>
                                        <td className="p-3">{stream.source_ip}:{stream.source_port}</td>
                                        <td className="p-3">{stream.destination_ip}:{stream.destination_port}</td>
                                        <td className="p-3 text-right text-neutral-200">{stream.packet_count}</td>
                                        <td className="p-3 text-right">
                                          <span className={`${stream.packet_loss_percent > 5.0 ? 'text-rose-400 font-bold' : 'text-neutral-300'}`}>
                                            {stream.packet_loss_percent}%
                                          </span>
                                        </td>
                                        <td className="p-3 text-right text-neutral-200">{stream.jitter_ms} ms</td>
                                        <td className="p-3 text-center">
                                          <span className="bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 text-[11px] font-semibold text-neutral-350">
                                            {stream.codec}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              <div className="bg-neutral-950 p-5 border border-neutral-800 rounded-xl space-y-3 col-span-1 lg:col-span-1">
                                <h4 className="text-xs font-bold text-neutral-450 uppercase tracking-widest font-mono">
                                  SIP Command Methods
                                </h4>
                                <div className="space-y-1.5 font-mono text-xs">
                                  {Object.entries(activeResult.pcap_summary!.sip_stats.methods).map(([method, count], id) => (
                                    <div key={id} className="flex justify-between items-center py-1 border-b border-neutral-900/60">
                                      <span className="text-neutral-400">{method}</span>
                                      <span className="font-semibold text-neutral-250 bg-neutral-900 px-2 py-0.5 rounded text-[11px]">
                                        {count as number}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="bg-neutral-950 p-5 border border-neutral-800 rounded-xl space-y-3 col-span-1 lg:col-span-2">
                                <h4 className="text-xs font-bold text-neutral-450 uppercase tracking-widest font-mono">
                                  SIP Status Responses Summary
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 font-mono text-xs">
                                  {Object.entries(activeResult.pcap_summary!.sip_stats.responses).map(([code, count], id) => {
                                    const isError = code.startsWith("4") || code.startsWith("5");
                                    const hasCount = (count as number) > 0;
                                    return (
                                      <div 
                                        key={id} 
                                        className={`p-3 rounded-lg border ${
                                          hasCount 
                                            ? isError 
                                              ? 'border-rose-500/15 bg-rose-500/5 text-rose-350 shadow-sm shadow-rose-950/10' 
                                              : 'border-emerald-550/15 bg-emerald-550/5 text-emerald-350'
                                            : 'border-neutral-900 bg-neutral-950 text-neutral-500 opacity-60'
                                        } flex flex-col justify-between`}
                                      >
                                        <span className="text-[10px] font-bold block opacity-70">CODE {code}</span>
                                        <div className="flex items-baseline justify-between mt-1">
                                          <span className="text-[11px] truncate font-medium">
                                            {code === "401" ? "Unauthorized" : code === "403" ? "Forbidden" : code === "404" ? "Not Found" : code === "408" ? "Timeout" : code === "480" ? "Unavailable" : code === "486" ? "Busy" : code === "487" ? "Terminated" : code === "500" ? "Server Error" : "Service Unavail"}
                                          </span>
                                          <span className={`text-[13px] font-semibold ${hasCount ? 'opacity-100 font-bold' : 'opacity-40'}`}>
                                            {count}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-neutral-900/40 p-5 rounded-xl border border-neutral-850 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono text-xs">
                              <div className="space-y-1">
                                <span className="text-[10px] text-neutral-550 uppercase tracking-widest block">STUN packets</span>
                                <span className="text-base font-bold text-neutral-250">{activeResult.pcap_summary!.stun_packets_count}</span>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] text-neutral-550 uppercase tracking-widest block">TURN allocations</span>
                                <span className="text-base font-bold text-neutral-250">{activeResult.pcap_summary!.turn_packets_count}</span>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] text-neutral-550 uppercase tracking-widest block">WebRTC channels</span>
                                <span className="text-base font-bold text-neutral-250">{activeResult.pcap_summary!.webrtc_packets_count}</span>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] text-neutral-550 uppercase tracking-widest block">WebSocket SIP text</span>
                                <span className="text-base font-bold text-neutral-250">{activeResult.pcap_summary!.websocket_sip_count}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  )
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 hover:bg-neutral-900/10 border border-dashed border-neutral-800 rounded-xl max-w-sm mx-auto text-center space-y-2">
                     <Clock className="w-8 h-8 text-neutral-600 animate-pulse" />
                     <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">No results fetched</h3>
                     <p className="text-[10px] text-neutral-500">Wait for background threads or reload details.</p>
                     <button 
                       onClick={() => fetchResult(activeJob.job_id, activeJob.job_type)}
                       className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-[11px] font-mono text-emerald-400"
                     >
                       Reload results
                     </button>
                  </div>
                )}
                </>
              )}

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
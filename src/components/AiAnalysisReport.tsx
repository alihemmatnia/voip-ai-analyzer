import React from "react";
import { ShieldAlert, CheckCircle2, AlertTriangle, Lightbulb, Activity, ArrowRight } from "lucide-react";
import { AiAnalysis } from "../types";

interface Props {
  analysis: AiAnalysis;
}

export default function AiAnalysisReport({ analysis }: Props) {
  if (!analysis) return null;

  const getHealthBadge = (health: string) => {
    switch (health.toLowerCase()) {
      case "good":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Good Health
          </span>
        );
      case "fair":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Fair Health Warnings
          </span>
        );
      case "critical":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            Critical Failure Risk
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-gradient-to-br from-slate-200 to-slate-50 p-6 border border-slate-200 rounded-xl shadow-sm">
        <div className="flex flex-col items-center justify-center p-4 bg-slate-100/80 border border-slate-200 rounded-xl text-center">
          <span className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-1">
            VoIP Health
          </span>
          <div className="mb-2">{getHealthBadge(analysis.overall_health)}</div>
          <div className="mt-2 text-3xl font-bold font-mono text-slate-900">
            {analysis.call_quality_score}
            <span className="text-lg text-slate-600 font-normal">/100</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 mt-1">Core Quality Metric</span>
        </div>

        <div className="md:col-span-3 space-y-2 flex flex-col justify-center">
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-widest font-mono flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            AI Root Cause Analysis
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed text-justify italic">
            "{analysis.executive_summary}"
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-100 p-5 border border-slate-200 rounded-xl">
          <h4 className="text-sm font-semibold text-rose-600 uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Critical Findings Detected
          </h4>
          {analysis.critical_findings && analysis.critical_findings.length > 0 ? (
            <div className="space-y-2.5">
              {analysis.critical_findings.map((finding, idx) => (
                <div key={idx} className="flex gap-2.5 p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 text-slate-700">
                  <span className="text-rose-400 font-bold font-mono text-xs mt-0.5">[{idx + 1}]</span>
                  <p className="text-xs leading-relaxed">{finding}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600 italic">No critical warning signs or failures were detected.</p>
          )}
        </div>

        <div className="bg-slate-100 p-5 border border-slate-200 rounded-xl">
          <h4 className="text-sm font-semibold text-amber-600 uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Probable Root Causes
          </h4>
          {analysis.root_causes && analysis.root_causes.length > 0 ? (
            <div className="space-y-2.5">
              {analysis.root_causes.map((rc, idx) => (
                <div key={idx} className="flex gap-2.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-slate-700">
                  <span className="text-amber-400 font-bold font-mono text-xs mt-0.5">#{idx + 1}</span>
                  <p className="text-xs leading-relaxed">{rc}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600 italic">No definite root cause identified. General operation stable.</p>
          )}
        </div>
      </div>

      <div className="bg-slate-100 p-6 border border-slate-200 rounded-xl">
        <h4 className="text-sm font-semibold text-emerald-450 uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          Recommended Remediation Steps
        </h4>
        {analysis.recommendations && analysis.recommendations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3.5 bg-white border border-slate-200 rounded-lg">
                <div className="p-1 px-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono leading-none">
                  STEP {idx + 1}
                </div>
                <div className="space-y-0.5 flex-grow">
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {rec}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600 italic">No specific action steps needed. System is compliant.</p>
        )}
      </div>
    </div>
  );
}

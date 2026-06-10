import React from "react";
import { ArrowRight, Clock, FileText } from "lucide-react";
import { CallFlowEvent } from "../types";

interface Props {
  events: CallFlowEvent[];
}

export default function CallFlowLadder({ events }: Props) {
  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-600 bg-slate-100 border border-slate-200 rounded-lg">
        <Clock className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm font-medium">No SIP messages recorded in this capture session</p>
      </div>
    );
  }

  const IPS = Array.from(new Set(events.flatMap(e => [e.source, e.destination])));
  const ip1 = IPS[0] || "Client";
  const ip2 = IPS[1] || "Server/PBX";

  return (
    <div className="bg-slate-50 p-6 border border-slate-200 rounded-xl space-y-4 shadow-sm overflow-x-auto">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-2">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          Reconstructed SIP Flow Ladder
        </h3>
        <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2.5 py-1 border border-slate-200 rounded-full">
          {events.length} SIP Messages mapped
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 min-w-[500px] text-center font-mono py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold">
        <div className="text-emerald-500 truncate px-2">{ip1}</div>
        <div className="text-slate-600">Directional Command Stream</div>
        <div className="text-sky-400 truncate px-2">{ip2}</div>
      </div>

      <div className="space-y-1 relative min-w-[500px] max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
<div className="absolute left-[16.666%] top-0 bottom-0 w-0.5 border-l border-dashed border-slate-200"></div>
          <div className="absolute left-[83.333%] top-0 bottom-0 w-0.5 border-l border-dashed border-slate-200"></div>

        {events.map((event, index) => {
          const isLeftToRight = event.source === ip1;
          const isRequest = !event.info.match(/^\d{3}/); 

          return (
            <div
              key={index}
              className="grid grid-cols-3 gap-4 py-2 hover:bg-slate-100 rounded px-1 transition-colors items-center text-xs font-mono"
            >
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-neutral-600" />
                <span>+{(event.time_ms / 1000).toFixed(3)}s</span>
              </div>

              <div className="relative flex flex-col items-center justify-center col-span-2">
                <div className="w-full flex items-center justify-between text-[11px]">
                  {isLeftToRight ? (
                    <div className="w-full flex items-center">
                      <div className="h-0.5 bg-emerald-500/80 flex-grow relative">
                        <div className="absolute right-0 top-1/2 -ml-1 -mt-1 border-y-4 border-y-transparent border-l-4 border-l-emerald-500"></div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full flex items-center">
                      <div className="h-0.5 bg-sky-500/80 flex-grow relative">
                        <div className="absolute left-0 top-1/2 -mr-1 -mt-1 border-y-4 border-y-transparent border-r-4 border-r-sky-500"></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-1 text-center bg-slate-100 border border-slate-200 px-2 py-0.5 rounded shadow-sm max-w-[280px] truncate text-slate-700">
                  <span className={`font-semibold ${isRequest ? "text-emerald-400" : "text-sky-400"}`}>
                    {event.info}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-slate-500 font-mono text-center pt-2 border-t border-slate-200">
        * Lines illustrate IP addresses detected as primary session initiators from invite fields.
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { 
  Send, 
  RotateCw, 
  User, 
  Cpu, 
  HelpCircle, 
  MessageSquare, 
  Activity, 
  BookOpen, 
  GraduationCap, 
  Terminal,
  X
} from "lucide-react";
import { ChatMessage, Job, UnifiedAnalysisResult } from "../types";

interface Props {
  job: Job;
  activeResult: UnifiedAnalysisResult | null;
  onClose: () => void;
}

export default function AnalysisChatPanel({ job, activeResult, onClose }: Props) {
  const jobId = job.job_id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState<"beginner" | "intermediate" | "expert">("expert");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
    const timer = setTimeout(scrollToBottom, 60);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  // Load chat session history and suggested questions
  const loadChatSession = async () => {
    setIsInitializing(true);
    try {
      const response = await fetch(`/api/v1/analysis/${jobId}/chat/history`);
      if (response.ok) {
        const data = await response.json();
        const historyData = data.history || [];
        const cleanHistory = historyData.map((msg: ChatMessage) => {
          if (msg.role === "assistant") {
            let content = msg.content || "";
            content = content.trim();
            if (content.startsWith("```markdown")) {
              content = content.substring(11).trim();
              if (content.endsWith("```")) {
                content = content.substring(0, content.length - 3).trim();
              }
            } else if (content.startsWith("```")) {
              content = content.substring(3).trim();
              if (content.endsWith("```")) {
                content = content.substring(0, content.length - 3).trim();
              }
            }
            return { ...msg, content };
          }
          return msg;
        });
        setMessages(cleanHistory);
        setSuggestedQuestions(data.suggested_questions || []);
      }
    } catch (e) {
      console.error("Error loading chat history:", e);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    loadChatSession();
  }, [jobId]);

  // Send a message
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    setIsLoading(true);
    const userMessageText = text.trim();
    setInputText("");

    // Append user message immediately to the UI
    const newUserMsg: ChatMessage = {
      role: "user",
      content: userMessageText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMsg]);

    try {
      const response = await fetch(`/api/v1/analysis/${jobId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessageText, mode })
      });

      if (response.ok) {
        const data = await response.json();
        let replyText = data.response || "";
        replyText = replyText.trim();
        if (replyText.startsWith("```markdown")) {
          replyText = replyText.substring(11).trim();
          if (replyText.endsWith("```")) {
            replyText = replyText.substring(0, replyText.length - 3).trim();
          }
        } else if (replyText.startsWith("```")) {
          replyText = replyText.substring(3).trim();
          if (replyText.endsWith("```")) {
            replyText = replyText.substring(0, replyText.length - 3).trim();
          }
        }
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: replyText,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        const errMsg = {
          role: "assistant" as const,
          content: "Error: Unable to connect to the VoIP AI Assistant. Please verify your LLM configurations.",
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, errMsg]);
      }
    } catch (e) {
      console.error("Error posting chat message:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to parse markdown tables into structured HTML
  const parseTables = (text: string): string => {
    const lines = text.split("\n");
    let inTable = false;
    let tableRows: string[][] = [];
    const newLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("|") && line.endsWith("|")) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        const cells = line.split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        tableRows.push(cells);
      } else {
        if (inTable) {
          inTable = false;
          if (tableRows.length >= 2) {
            const headers = tableRows[0];
            const separatorRow = tableRows[1];
            const isSeparator = separatorRow.every(cell => /^:?-+:?$/.test(cell));
            
            let headerHtml = "";
            let bodyRows = tableRows;
            
            if (isSeparator) {
              headerHtml = `<thead><tr class="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">${headers.map(h => `<th class="p-2 border border-slate-200 text-left font-semibold">${h}</th>`).join("")}</tr></thead>`;
              bodyRows = tableRows.slice(2);
            }
            
            const bodyHtml = `<tbody>${bodyRows.map(row => `<tr class="hover:bg-slate-50/50 border-b border-slate-100">${row.map(cell => `<td class="p-2 border border-slate-200">${cell}</td>`).join("")}</tr>`).join("")}</tbody>`;
            
            const tableHtml = `<div class="overflow-x-auto my-3 border border-slate-200 rounded-lg shadow-sm"><table class="w-full text-[12px] border-collapse font-sans bg-white">${headerHtml}${bodyHtml}</table></div>`;
            newLines.push(tableHtml);
          } else {
            tableRows.forEach(row => newLines.push("| " + row.join(" | ") + " |"));
          }
          tableRows = [];
        }
        newLines.push(lines[i]);
      }
    }
    
    if (inTable && tableRows.length >= 2) {
      const headers = tableRows[0];
      const separatorRow = tableRows[1];
      const isSeparator = separatorRow.every(cell => /^:?-+:?$/.test(cell));
      let headerHtml = "";
      let bodyRows = tableRows;
      if (isSeparator) {
        headerHtml = `<thead><tr class="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">${headers.map(h => `<th class="p-2 border border-slate-200 text-left font-semibold">${h}</th>`).join("")}</tr></thead>`;
        bodyRows = tableRows.slice(2);
      }
      const bodyHtml = `<tbody>${bodyRows.map(row => `<tr class="hover:bg-slate-50/50 border-b border-slate-100">${row.map(cell => `<td class="p-2 border border-slate-200">${cell}</td>`).join("")}</tr>`).join("")}</tbody>`;
      const tableHtml = `<div class="overflow-x-auto my-3 border border-slate-200 rounded-lg shadow-sm"><table class="w-full text-[12px] border-collapse font-sans bg-white">${headerHtml}${bodyHtml}</table></div>`;
      newLines.push(tableHtml);
    } else if (inTable) {
      tableRows.forEach(row => newLines.push("| " + row.join(" | ") + " |"));
    }
    
    return newLines.join("\n");
  };

  // Simple, robust Markdown parser helper
  const renderMarkdown = (text: string) => {
    // 1. Escape HTML
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 2. Parse Tables
    html = parseTables(html);

    // 3. Code blocks: ```(?:lang)?\n?code``` with light styling
    html = html.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]+?)```/g, "<pre class='bg-[#f5f5f5] text-[#111827] border border-[#e5e7eb] p-4 rounded-lg font-mono text-[12px] overflow-x-auto my-3 whitespace-pre-wrap leading-relaxed'>$1</pre>");
    // 4. Bold: **text** with dark gray color
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong class='font-bold text-[#111827]'>$1</strong>");
    // 5. Inline code: `code`
    html = html.replace(/`([^`]+)`/g, "<code class='bg-[#f5f5f5] text-[#111827] px-1.5 py-0.5 rounded font-mono text-[12px] font-semibold border border-[#e5e7eb]'>$1</code>");
    // 6. Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href='$2' target='_blank' rel='noopener noreferrer' class='text-blue-600 hover:text-blue-800 hover:underline font-medium'>$1</a>");
    // 7. Headers: ###, ##, #
    html = html.replace(/^### (.*$)/gim, "<h4 class='text-[10px] font-bold text-slate-500 tracking-wider mt-4 mb-1 uppercase font-mono flex items-center gap-1.5 border-b border-slate-100 pb-1'>$1</h4>");
    html = html.replace(/^## (.*$)/gim, "<h3 class='text-sm font-bold text-[#111827] mt-4 mb-2'>$1</h3>");
    html = html.replace(/^# (.*$)/gim, "<h2 class='text-base font-bold text-[#111827] mt-5 mb-2'>$1</h2>");
    // 8. Bullets: * or -
    html = html.replace(/^\s*[\*\-]\s+(.*$)/gim, "<li class='ml-4 list-disc text-sm text-slate-700 leading-relaxed py-0.5'>$1</li>");
    
    // Group adjacent lists into <ul> block
    html = html.replace(/(<li class='ml-4 list-disc text-sm text-slate-700 leading-relaxed py-0.5'>.*<\/li>)+/g, "<ul class='my-2'>$&</ul>");

    const lines = html.split("\n");
    const parsedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith("<li") || trimmed.startsWith("<pre") || trimmed.startsWith("<h") || trimmed.startsWith("<ul") || trimmed.startsWith("</ul") || trimmed.startsWith("<div") || trimmed.startsWith("<table") || trimmed.startsWith("<thead") || trimmed.startsWith("<tbody") || trimmed.startsWith("<tr") || trimmed.startsWith("<th") || trimmed.startsWith("<td") || trimmed.endsWith("</table>") || trimmed.endsWith("</div>")) {
        return line;
      }
      return trimmed ? `<p class="text-sm text-[#111827] leading-relaxed mb-3">${line}</p>` : "";
    });

    return <div className="space-y-1 font-sans text-[#111827]" dangerouslySetInnerHTML={{ __html: parsedLines.join("") }} />;
  };

  return (
    <div className="fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-0 lg:h-full lg:w-[450px] lg:min-w-[400px] lg:max-w-[500px] w-full flex flex-col bg-white border-l border-slate-200 shadow-xl overflow-hidden h-[100vh] lg:h-auto">
      
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-2.5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-600">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">AI VoIP Assistant</h3>
              <p className="text-[10px] text-slate-500 font-mono">Senior VoIP Engineer (15+ Yrs)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Analysis Status Board */}
        <div className="grid grid-cols-3 gap-1 bg-white p-2 rounded-lg border border-slate-150 text-[10px] font-mono shadow-sm select-none">
          <div className="flex flex-col px-1.5 border-r border-slate-100">
            <span className="text-slate-400 uppercase tracking-wider text-[8px] font-semibold">Analysis ID</span>
            <span className="text-slate-700 font-bold truncate mt-0.5" title={job.job_id}>#{job.job_id.substring(0, 8)}</span>
          </div>
          <div className="flex flex-col px-1.5 border-r border-slate-100">
            <span className="text-slate-400 uppercase tracking-wider text-[8px] font-semibold">Type</span>
            <span className="text-slate-700 font-bold uppercase mt-0.5">{job.job_type}</span>
          </div>
          <div className="flex flex-col px-1.5">
            <span className="text-slate-400 uppercase tracking-wider text-[8px] font-semibold">Health</span>
            <span className={`font-bold mt-0.5 ${
              (activeResult?.ai_analysis?.overall_health || "").toLowerCase() === "critical"
                ? "text-rose-500"
                : (activeResult?.ai_analysis?.overall_health || "").toLowerCase() === "warning" || (activeResult?.ai_analysis?.overall_health || "").toLowerCase() === "fair"
                  ? "text-amber-500"
                  : "text-emerald-500"
            }`}>
              {activeResult?.ai_analysis?.overall_health || "Unknown"}
            </span>
          </div>
        </div>
      </div>

      {/* Suggested Questions Horizontal Swipe */}
      {suggestedQuestions.length > 0 && !isInitializing && (
        <div className="px-4 py-2 border-b border-slate-150 bg-slate-50/50 flex-shrink-0">
          <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-1.5 select-none font-bold">
            <HelpCircle className="w-3 h-3 text-slate-400" />
            Suggested Investigations
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 select-none custom-scrollbar">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={isLoading}
                className="flex-shrink-0 text-[10px] font-medium bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-650 hover:text-slate-900 border border-slate-200 hover:border-slate-350 rounded-full px-3 py-1 shadow-sm transition-all disabled:opacity-50"
                title={q}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Audience Mode Selector */}
      <div className="px-4 py-2 border-b border-slate-150 bg-white flex items-center justify-between text-[11px] flex-shrink-0">
        <span className="text-slate-500 font-mono font-medium">Audience Mode:</span>
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setMode("beginner")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
              mode === "beginner" 
                ? "bg-white text-emerald-600 shadow-sm font-semibold" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Beginner
          </button>
          <button
            onClick={() => setMode("intermediate")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
              mode === "intermediate" 
                ? "bg-white text-emerald-600 shadow-sm font-semibold" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Intermediate
          </button>
          <button
            onClick={() => setMode("expert")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
              mode === "expert" 
                ? "bg-white text-emerald-600 shadow-sm font-semibold" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Expert
          </button>
        </div>
      </div>

      {/* Messages Window */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 custom-scrollbar scroll-smooth"
      >
        {isInitializing ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <RotateCw className="w-6 h-6 animate-spin text-emerald-500" />
            <p className="text-[11px] font-mono">Initializing chat history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-emerald-500">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-800">Consult the VoIP Expert</h4>
              <p className="text-[10px] text-slate-500 max-w-[220px] mx-auto leading-relaxed">
                Review this analysis interactively. Ask questions about the root causes, timeline sequence, codecs, or request troubleshooting CLI commands.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              return (
                <div key={index} className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
                  
                  {/* Assistant Avatar */}
                  {!isUser && (
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                      <Cpu className="w-4 h-4" />
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`max-w-[85%] rounded-xl p-3.5 shadow-sm border ${
                    isUser 
                      ? "bg-sky-50 border-sky-200 text-sky-950 rounded-tr-none" 
                      : "bg-white border-slate-200 text-slate-800 rounded-tl-none"
                  }`}>
                    {isUser ? (
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      renderMarkdown(msg.content)
                    )}
                    
                    <div className="text-[8px] font-mono mt-1 text-right text-slate-500 select-none">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* User Avatar */}
                  {isUser && (
                    <div className="w-7 h-7 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 flex-shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}

                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-2.5 justify-start items-start animate-pulse">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 text-slate-850 rounded-xl rounded-tl-none p-4 shadow-sm flex flex-col gap-2 max-w-[85%]">
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">VoIP Expert is reviewing data...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Form Box */}
      <div className="p-4 border-t border-slate-200 bg-white flex-shrink-0">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputText);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder={isLoading ? "Review in progress..." : "Ask the VoIP engineer..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading || isInitializing}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading || isInitializing}
            className="p-2 bg-slate-900 hover:bg-slate-850 active:bg-black text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
}

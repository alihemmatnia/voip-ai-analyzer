import React, { useState, useEffect } from "react";
import { Server, Terminal, Plus, Trash2, X, RefreshCw, TerminalSquare, AlertTriangle } from "lucide-react";

export default function LiveSystemsPanel() {
  const [servers, setServers] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedServer, setSelectedServer] = useState<any | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");
  const [platform, setPlatform] = useState("Asterisk");

  // Terminal state
  const [terminalOutput, setTerminalOutput] = useState("");
  const [command, setCommand] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);

  const fetchServers = async () => {
    try {
      const res = await fetch("/api/v1/servers");
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      }
    } catch (e) {
      console.error("Failed to fetch servers", e);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ip_address: ipAddress, port, username, password, platform }),
      });
      if (res.ok) {
        fetchServers();
        setShowAddForm(false);
        setName(""); setIpAddress(""); setPassword("");
      }
    } catch (e) {
      console.error("Failed to add server", e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/v1/servers/${id}`, { method: "DELETE" });
      if (selectedServer?.id === id) setSelectedServer(null);
      fetchServers();
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const executeCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedServer || !command.trim()) return;

    setIsExecuting(true);
    setTerminalOutput(prev => prev + `\n$ ${command}\n...`);
    
    try {
      const res = await fetch(`/api/v1/servers/${selectedServer.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();
      if (res.ok) {
        setTerminalOutput(prev => prev.replace("...", data.output));
      } else {
        setTerminalOutput(prev => prev.replace("...", `Error: ${data.detail}`));
      }
    } catch (e: any) {
      setTerminalOutput(prev => prev.replace("...", `Error: ${e.message}`));
    } finally {
      setIsExecuting(false);
      setCommand("");
    }
  };

  const fetchLogs = async () => {
    if (!selectedServer) return;
    setIsExecuting(true);
    setTerminalOutput(prev => prev + `\nFetching live logs for ${selectedServer.platform}...\n`);
    
    try {
      const res = await fetch(`/api/v1/servers/${selectedServer.id}/logs?lines=50`);
      const data = await res.json();
      if (res.ok) {
        setTerminalOutput(prev => prev + data.logs);
      } else {
        setTerminalOutput(prev => prev + `Error: ${data.detail}\n`);
      }
    } catch (e: any) {
      setTerminalOutput(prev => prev + `Error: ${e.message}\n`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden text-slate-900">
      
      <div className="grid grid-cols-1 lg:grid-cols-4 h-full">
        <aside className="lg:col-span-1 border-r border-slate-200 bg-white p-5 flex flex-col gap-6 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest font-mono">
              Managed Servers
            </h2>
            <button 
              onClick={() => setShowAddForm(true)}
              className="p-1 hover:bg-emerald-50 text-emerald-600 rounded-md transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {servers.length === 0 ? (
              <div className="text-center p-6 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                <Server className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No servers configured.</p>
              </div>
            ) : (
              servers.map(srv => (
                <div 
                  key={srv.id}
                  onClick={() => { setSelectedServer(srv); setTerminalOutput(""); }}
                  className={`p-3 border rounded-xl cursor-pointer transition-all ${
                    selectedServer?.id === srv.id 
                      ? "border-emerald-500 bg-emerald-50 shadow-sm" 
                      : "border-slate-200 hover:border-emerald-300 bg-white"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm truncate">{srv.name}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(srv.id); }}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    {srv.username}@{srv.ip_address}:{srv.port}
                  </div>
                  <div className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded inline-block mt-1">
                    {srv.platform}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        <main className="lg:col-span-3 bg-slate-950 flex flex-col relative overflow-hidden">
          {showAddForm && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg">Add PBX Server</h3>
                  <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleAddServer} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Friendly Name</label>
                    <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="e.g. Core Kamailio 1" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-600 block mb-1">IP Address</label>
                      <input required type="text" value={ipAddress} onChange={e => setIpAddress(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="10.0.0.5" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">SSH Port</label>
                      <input required type="number" value={port} onChange={e => setPort(Number(e.target.value))} className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">SSH Username</label>
                      <input required type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Password</label>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="Leave blank if using key" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Platform Type</label>
                    <select value={platform} onChange={e => setPlatform(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none bg-white">
                      <option value="Asterisk">Asterisk</option>
                      <option value="FreeSWITCH">FreeSWITCH</option>
                      <option value="Kamailio">Kamailio</option>
                      <option value="OpenSIPS">OpenSIPS</option>
                    </select>
                  </div>
                  <div className="pt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm">Save Server</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {!selectedServer ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 space-y-4">
              <TerminalSquare className="w-16 h-16 opacity-20" />
              <p className="text-sm font-mono tracking-wide">Select a server to open terminal</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="bg-slate-900 border-b border-slate-800 p-3 flex justify-between items-center text-slate-300 shadow-md z-10">
                <div className="flex items-center gap-3">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono text-sm font-semibold">{selectedServer.username}@{selectedServer.ip_address}</span>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">{selectedServer.platform}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={fetchLogs} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-mono text-slate-300 flex items-center gap-2 transition-all">
                    <RefreshCw className="w-3 h-3" /> Get Live Logs
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 bg-[#0A0A0A] custom-scrollbar text-emerald-400 font-mono text-xs whitespace-pre-wrap">
                {terminalOutput || <span className="opacity-50 italic text-slate-500">Connected. Run a command or fetch live logs...</span>}
              </div>

              <form onSubmit={executeCommand} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
                <span className="text-emerald-500 font-mono font-bold">$&gt;</span>
                <input 
                  type="text" 
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  className="flex-1 bg-transparent text-emerald-400 font-mono text-sm outline-none placeholder-slate-600"
                  placeholder={`sngrep -c or asterisk -rx 'core show channels'`}
                  disabled={isExecuting}
                  autoFocus
                />
                <button 
                  type="submit" 
                  disabled={isExecuting || !command.trim()}
                  className="px-4 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/40 rounded font-mono text-xs disabled:opacity-50 transition-all"
                >
                  {isExecuting ? "Wait..." : "Execute"}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

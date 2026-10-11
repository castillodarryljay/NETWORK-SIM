import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Activity,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
  Trash2,
  Play,
  ArrowRight,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CliSessionState,
  DiagnosticIssue,
  NetworkDevice,
  PacketStepEvent,
  SimulationSession,
} from '../types/network';
import { getCliPrompt } from '../engine/cliParser';

interface BottomWorkspaceDockProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  activeTab: 'cli' | 'packets' | 'diagnostics';
  onSetTab: (tab: 'cli' | 'packets' | 'diagnostics') => void;
  devices: NetworkDevice[];
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  cliSessions: Record<string, CliSessionState>;
  onExecuteCliCommand: (deviceId: string, command: string) => void;
  activeSimulation: SimulationSession | null;
  currentStepIndex: number;
  onSelectStepIndex: (index: number) => void;
  diagnosticIssues: DiagnosticIssue[];
  onRunDiagnostics: () => void;
}

const COMMON_AUTOCOMPLETE_WORDS = [
  'enable',
  'configure terminal',
  'interface GigabitEthernet0/0',
  'interface GigabitEthernet0/1',
  'interface FastEthernet0/1',
  'interface FastEthernet0/2',
  'ip address ',
  'no shutdown',
  'shutdown',
  'show ip interface brief',
  'show ip route',
  'show running-config',
  'show vlan brief',
  'show mac address-table',
  'show arp',
  'switchport mode access',
  'switchport mode trunk',
  'switchport access vlan ',
  'ip route ',
  'ping ',
  'ipconfig',
  'ipconfig /all',
  'ipconfig /renew',
  'arp -a',
  'route print',
  'copy running-config startup-config',
];

export const BottomWorkspaceDock: React.FC<BottomWorkspaceDockProps> = ({
  isOpen,
  onToggleOpen,
  activeTab,
  onSetTab,
  devices,
  selectedDeviceId,
  onSelectDevice,
  cliSessions,
  onExecuteCliCommand,
  activeSimulation,
  currentStepIndex,
  onSelectStepIndex,
  diagnosticIssues,
  onRunDiagnostics,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [historyCursor, setHistoryCursor] = useState<number>(-1);
  const [fontSize, setFontSize] = useState<'xs' | 'sm'>('xs');
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');

  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const activeCliDevice =
    devices.find((d) => d.id === selectedDeviceId) || devices[0] || null;

  const currentCliSession: CliSessionState =
    (activeCliDevice && cliSessions[activeCliDevice.id]) || {
      mode:
        activeCliDevice &&
        ['pc', 'laptop', 'server', 'printer'].includes(activeCliDevice.type)
          ? 'pc_shell'
          : 'user_exec',
      history: [],
      outputLines: [
        {
          id: 'welcome',
          text: activeCliDevice
            ? `${activeCliDevice.model} Console Ready. Type "?" or "help" for available commands.`
            : 'Select a device to begin CLI session.',
          type: 'info',
        },
      ],
    };

  useEffect(() => {
    if (isOpen && activeTab === 'cli') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentCliSession.outputLines.length, isOpen, activeTab]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!activeCliDevice) return;

    if (e.key === '?') {
      e.preventDefault();
      onExecuteCliCommand(activeCliDevice.id, '?');
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const lower = commandInput.toLowerCase();
      if (!lower.trim()) return;
      const match = COMMON_AUTOCOMPLETE_WORDS.find((w) =>
        w.toLowerCase().startsWith(lower)
      );
      if (match) {
        setCommandInput(match);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const hist = currentCliSession.history;
      if (hist.length === 0) return;
      const nextIdx = historyCursor < 0 ? hist.length - 1 : Math.max(0, historyCursor - 1);
      setHistoryCursor(nextIdx);
      setCommandInput(hist[nextIdx]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const hist = currentCliSession.history;
      if (historyCursor < 0) return;
      if (historyCursor >= hist.length - 1) {
        setHistoryCursor(-1);
        setCommandInput('');
      } else {
        setHistoryCursor(historyCursor + 1);
        setCommandInput(hist[historyCursor + 1]);
      }
    }
  };

  const handleSubmitCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCliDevice) return;
    onExecuteCliCommand(activeCliDevice.id, commandInput);
    setCommandInput('');
    setHistoryCursor(-1);
  };

  const filteredEvents =
    activeSimulation?.events.filter(
      (ev) => protocolFilter === 'ALL' || ev.protocol === protocolFilter
    ) || [];

  const inspectedEvent: PacketStepEvent | undefined =
    activeSimulation?.events[
      Math.min(currentStepIndex, Math.max(0, (activeSimulation?.events.length || 1) - 1))
    ];

  return (
    <div
      className={`border-t border-slate-800 bg-slate-950 flex flex-col transition-all ${
        isOpen ? 'h-76 sm:h-84' : 'h-10'
      } shrink-0`}
    >
      {/* Dock Header Bar */}
      <div className="h-10 px-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => {
              onSetTab('cli');
              if (!isOpen) onToggleOpen();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              isOpen && activeTab === 'cli'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>CLI Terminal</span>
            {activeCliDevice && (
              <span className="font-mono text-[11px] text-cyan-400">({activeCliDevice.name})</span>
            )}
          </button>

          <button
            onClick={() => {
              onSetTab('packets');
              if (!isOpen) onToggleOpen();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              isOpen && activeTab === 'packets'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Packet Event Timeline & OSI Inspector</span>
            {activeSimulation && (
              <span className="font-mono text-[11px] text-emerald-400 tabular-nums">
                ({activeSimulation.events.length} events)
              </span>
            )}
          </button>

          <button
            onClick={() => {
              onSetTab('diagnostics');
              if (!isOpen) onToggleOpen();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              isOpen && activeTab === 'diagnostics'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Network Diagnostics</span>
            {diagnosticIssues.length > 0 && (
              <span className="font-mono text-[11px] text-amber-400 tabular-nums">
                ({diagnosticIssues.length} findings)
              </span>
            )}
          </button>
        </div>

        <button
          onClick={onToggleOpen}
          aria-label={isOpen ? 'Collapse bottom panel' : 'Expand bottom panel'}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <span>{isOpen ? 'Collapse' : 'Expand Console'}</span>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Dock Content */}
      {isOpen && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* 1. INTEGRATED CISCO IOS & PC CLI TERMINAL */}
          {activeTab === 'cli' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
              {/* Device Session Switcher Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/80 text-xs">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">Session:</span>
                  {devices.map((dev) => (
                    <button
                      key={dev.id}
                      onClick={() => onSelectDevice(dev.id)}
                      className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors whitespace-nowrap ${
                        activeCliDevice?.id === dev.id
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {dev.name}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => activeCliDevice && onExecuteCliCommand(activeCliDevice.id, '?')}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
                  >
                    <HelpCircle className="w-3 h-3 text-cyan-400" /> ? Help
                  </button>
                  <button
                    onClick={() => setFontSize((f) => (f === 'xs' ? 'sm' : 'xs'))}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                  >
                    Font: {fontSize.toUpperCase()}
                  </button>
                  <button
                    onClick={() => activeCliDevice && onExecuteCliCommand(activeCliDevice.id, 'clear')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Scrollable Terminal Output */}
              <div
                onClick={() => inputRef.current?.focus()}
                className={`flex-1 overflow-y-auto p-3 font-mono ${
                  fontSize === 'sm' ? 'text-sm' : 'text-xs'
                } space-y-1 cursor-text`}
              >
                {currentCliSession.outputLines.map((line) => (
                  <div
                    key={line.id}
                    className={`whitespace-pre-wrap break-words leading-relaxed ${
                      line.type === 'input'
                        ? 'text-slate-100 font-semibold'
                        : line.type === 'error'
                        ? 'text-rose-400'
                        : line.type === 'success'
                        ? 'text-emerald-400'
                        : line.type === 'info'
                        ? 'text-cyan-300'
                        : 'text-slate-300'
                    }`}
                  >
                    {line.text}
                  </div>
                ))}

                {/* Active Prompt Input Line */}
                {activeCliDevice && (
                  <form onSubmit={handleSubmitCommand} className="flex items-center gap-2 pt-1">
                    <span className="text-cyan-400 font-bold shrink-0">
                      {getCliPrompt(activeCliDevice, currentCliSession)}
                    </span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={commandInput}
                      onChange={(e) => setCommandInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder='Type command (Press "?" for contextual help, Tab to autocomplete)...'
                      aria-label="CLI Command Input"
                      className="flex-1 bg-transparent text-slate-100 focus:outline-none font-mono"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </form>
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>
          )}

          {/* 2. PACKET EVENT TIMELINE & OSI ENCAPSULATION INSPECTOR */}
          {activeTab === 'packets' && (
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-950">
              {/* Left: Event Timeline Table */}
              <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    Discrete Simulation Events {activeSimulation ? `— ${activeSimulation.title}` : ''}
                  </span>
                  <div className="flex items-center gap-1">
                    {(['ALL', 'ARP', 'ICMP', 'DNS', 'HTTP', 'DHCP'] as const).map((proto) => (
                      <button
                        key={proto}
                        onClick={() => setProtocolFilter(proto)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                          protocolFilter === proto
                            ? 'bg-cyan-500 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {proto}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/70 text-xs">
                  {!activeSimulation || filteredEvents.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">
                      No packet events recorded yet. Click <strong>Send Ping</strong> in the toolbar or run <code className="text-cyan-300">ping &lt;ip&gt;</code> in the CLI to inspect live ARP, Switching, Routing, and ICMP packets.
                    </div>
                  ) : (
                    filteredEvents.map((ev, idx) => {
                      const isSelected = inspectedEvent?.id === ev.id;
                      return (
                        <button
                          key={ev.id}
                          onClick={() => onSelectStepIndex(ev.stepIndex - 1)}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors ${
                            isSelected ? 'bg-cyan-500/15' : 'hover:bg-slate-900/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono text-[11px] text-slate-400 tabular-nums w-6">
                              #{ev.stepIndex}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                ev.status === 'error'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : ev.protocol === 'ARP'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-cyan-500/20 text-cyan-300'
                              }`}
                            >
                              {ev.protocol}
                            </span>
                            <span className="text-slate-200 truncate">{ev.summary}</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 shrink-0">
                            {ev.fromDeviceName} {ev.toDeviceName ? `→ ${ev.toDeviceName}` : ''}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right: OSI Layer & PDU Encapsulation Inspector */}
              <div className="w-full lg:w-96 xl:w-112 p-3 overflow-y-auto bg-slate-900/40 text-xs space-y-2.5">
                {!inspectedEvent ? (
                  <div className="text-slate-400 text-center py-8">
                    Select any packet event on the left to inspect its OSI Layers, MAC/IP headers, TTL, VLAN tags, and forwarding decision.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div>
                        <span className="font-semibold text-white">
                          Step #{inspectedEvent.stepIndex}: {inspectedEvent.protocol} PDU Details
                        </span>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Action: <span className="uppercase font-mono text-cyan-300">{inspectedEvent.action}</span>
                          {inspectedEvent.vlanId ? ` · VLAN ${inspectedEvent.vlanId}` : ''} · TTL: {inspectedEvent.ttl}
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                      <strong className="text-cyan-300">Forwarding Decision: </strong>
                      {inspectedEvent.reason}
                    </div>

                    {/* OSI Layers Stack */}
                    <div className="space-y-1.5 font-mono text-[11px]">
                      {inspectedEvent.osiLayers.layer7 && (
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <span className="text-emerald-400 font-bold">L7 Application: </span>
                          <span className="text-slate-200">{inspectedEvent.osiLayers.layer7}</span>
                        </div>
                      )}
                      {inspectedEvent.osiLayers.layer4 && (
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <span className="text-amber-400 font-bold">L4 Transport: </span>
                          <span className="text-slate-200">{inspectedEvent.osiLayers.layer4}</span>
                        </div>
                      )}
                      {inspectedEvent.osiLayers.layer3 && (
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <span className="text-cyan-400 font-bold">L3 Network: </span>
                          <span className="text-slate-200">{inspectedEvent.osiLayers.layer3}</span>
                        </div>
                      )}
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-sky-400 font-bold">L2 Data Link: </span>
                        <span className="text-slate-200">{inspectedEvent.osiLayers.layer2}</span>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 font-bold">L1 Physical: </span>
                        <span className="text-slate-300">{inspectedEvent.osiLayers.layer1}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 3. AUTOMATED NETWORK DIAGNOSTICS ("Check Network") */}
          {activeTab === 'diagnostics' && (
            <div className="flex-1 overflow-y-auto p-3 bg-slate-950 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-200">
                    Automated Topology & Configuration Audit
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Click any finding below to jump directly to the affected device inspector and CLI session.
                  </p>
                </div>
                <button
                  onClick={onRunDiagnostics}
                  className="px-3 py-1.5 rounded bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 whitespace-nowrap"
                >
                  Re-Scan Network
                </button>
              </div>

              {diagnosticIssues.length === 0 ? (
                <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3 text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <div>
                    <div className="font-semibold">All Network Checks Passed!</div>
                    <div className="text-[11px] text-emerald-200/80">
                      No shutdown interfaces, duplicate IPs, invalid gateways, trunk mismatches, or missing static routes were detected in the current topology.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {diagnosticIssues.map((issue) => (
                    <div
                      key={issue.id}
                      onClick={() => onSelectDevice(issue.deviceId)}
                      role="button"
                      tabIndex={0}
                      className="p-3 rounded-lg border border-slate-800 bg-slate-900/70 hover:border-cyan-500/50 transition-colors cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            issue.severity === 'error' ? 'text-rose-400' : 'text-amber-400'
                          }`}
                        >
                          {issue.severity === 'error' ? (
                            <XCircle className="w-4 h-4 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                          )}
                          {issue.title}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {issue.confirmed ? 'Confirmed Problem' : 'Possible Cause'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">{issue.evidence}</p>
                      <div className="text-[11px] text-cyan-300">
                        <strong>Suggested Fix:</strong> {issue.suggestedAction}
                      </div>
                      {issue.cliHint && (
                        <pre className="p-1.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300">
                          {issue.cliHint}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

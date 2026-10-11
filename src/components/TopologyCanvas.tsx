import React, { useState, useRef } from 'react';
import {
  Plus,
  Cable,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Play,
  StepForward,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  Terminal,
  Sliders,
  Monitor,
  Server,
  Router,
  Network,
  Wifi,
  Shield,
  Cloud,
  Laptop,
  Printer,
  StickyNote,
  Undo2,
  Redo2,
  Copy,
  Grid,
  MousePointer,
  AlertTriangle,
  Info,
  X,
  FileDown,
} from 'lucide-react';
import {
  DeviceCategory,
  DeviceModelTemplate,
  DeviceType,
  LinkType,
  NetworkDevice,
  NetworkInterface,
  NetworkLink,
  NetworkProject,
  PacketStepEvent,
  SimulationSession,
} from '../types/network';
import { DEVICE_CATALOG } from '../utils/networkMath';
import { CanvasTool } from '../store/persistence';

export function DeviceNodeSvg({ type, className = 'w-6 h-6' }: { type: DeviceType; className?: string }) {
  switch (type) {
    case 'pc':
      return <Monitor className={className} />;
    case 'laptop':
      return <Laptop className={className} />;
    case 'server':
      return <Server className={className} />;
    case 'printer':
      return <Printer className={className} />;
    case 'router':
      return <Router className={className} />;
    case 'l2-switch':
    case 'l3-switch':
      return <Network className={className} />;
    case 'wireless-ap':
    case 'wireless-router':
      return <Wifi className={className} />;
    case 'firewall':
      return <Shield className={className} />;
    case 'wan-cloud':
      return <Cloud className={className} />;
    default:
      return <Monitor className={className} />;
  }
}

interface TopologyCanvasProps {
  project: NetworkProject;
  selectedDeviceId: string | null;
  onSelectDevice: (id: string | null) => void;
  activeTool: CanvasTool;
  onSetTool: (tool: CanvasTool) => void;
  onAddDevice: (template: DeviceModelTemplate, x?: number, y?: number) => void;
  onMoveDevice: (id: string, x: number, y: number) => void;
  onDeleteDevice: (id: string) => void;
  onDuplicateDevice: (id: string) => void;
  onCreateLink: (
    srcDevId: string,
    srcIfId: string,
    dstDevId: string,
    dstIfId: string,
    linkType: LinkType
  ) => { ok: boolean; error?: string };
  onDeleteLink: (linkId: string) => void;
  onAddAnnotation: (text: string, x: number, y: number) => void;
  onUpdateAnnotation: (id: string, newText: string) => void;
  onDeleteAnnotation: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  snapToGrid: boolean;
  onToggleSnapToGrid: () => void;
  // Simulation & Packet playback
  simulationMode: 'realtime' | 'step';
  onSetSimulationMode: (mode: 'realtime' | 'step') => void;
  activeSimulation: SimulationSession | null;
  currentStepIndex: number;
  isPlayingSteps: boolean;
  simulationSpeed: number;
  onSetSimulationSpeed: (speed: number) => void;
  onPlayPauseSteps: () => void;
  onNextStep: () => void;
  onResetSteps: () => void;
  onRunQuickPing: (srcId: string, dstIp: string) => void;
  onRunDiagnostics: () => void;
  onOpenCliForDevice: (deviceId: string) => void;
  onOpenDesktopModal: (deviceId: string) => void;
  onOpenMobileInspector?: () => void;
  onExportPdf?: () => void;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  project,
  selectedDeviceId,
  onSelectDevice,
  activeTool,
  onSetTool,
  onAddDevice,
  onMoveDevice,
  onDeleteDevice,
  onDuplicateDevice,
  onCreateLink,
  onDeleteLink,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  snapToGrid,
  onToggleSnapToGrid,
  simulationMode,
  onSetSimulationMode,
  activeSimulation,
  currentStepIndex,
  isPlayingSteps,
  simulationSpeed,
  onSetSimulationSpeed,
  onPlayPauseSteps,
  onNextStep,
  onResetSteps,
  onRunQuickPing,
  onRunDiagnostics,
  onOpenCliForDevice,
  onOpenDesktopModal,
  onOpenMobileInspector,
  onExportPdf,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [draggingDeviceId, setDraggingDeviceId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Animated Packet Travel Progress (0 -> 1 along the active link)
  const [packetTravelProgress, setPacketTravelProgress] = useState<number>(0.5);

  const currentStepEvent: PacketStepEvent | undefined =
    activeSimulation && activeSimulation.events.length > 0
      ? activeSimulation.events[Math.min(currentStepIndex, activeSimulation.events.length - 1)]
      : undefined;

  React.useEffect(() => {
    if (!currentStepEvent) return;
    let rafId: number;
    const durationMs = Math.max(260, Math.round(680 / simulationSpeed));
    const startTime = performance.now();
    setPacketTravelProgress(0);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // Smooth ease-out cubic curve
      const eased = 1 - Math.pow(1 - t, 3);
      setPacketTravelProgress(eased);
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [currentStepEvent?.id, currentStepIndex, simulationSpeed]);

  // Cable connection state
  const [connectSourceDeviceId, setConnectSourceDeviceId] = useState<string | null>(null);
  const [connectSourceInterfaceId, setConnectSourceInterfaceId] = useState<string | null>(null);
  const [connectTargetDeviceId, setConnectTargetDeviceId] = useState<string | null>(null);
  const [preferredLinkType, setPreferredLinkType] = useState<LinkType>('ethernet');
  const [connectionWarning, setConnectionWarning] = useState<string | null>(null);

  // Quick Ping bar state
  const [pingSourceId, setPingSourceId] = useState<string>('');
  const [pingTargetInput, setPingTargetInput] = useState<string>('');

  // Mobile Library Drawer
  const [mobileLibOpen, setMobileLibOpen] = useState(false);
  const [libCategory, setLibCategory] = useState<DeviceCategory | 'all'>('all');
  const [libSearch, setLibSearch] = useState('');
  const [showInterfaceLabels, setShowInterfaceLabels] = useState(true);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editingAnnotationText, setEditingAnnotationText] = useState<string>('');

  const svgRef = useRef<SVGSVGElement | null>(null);

  const filteredCatalog = DEVICE_CATALOG.filter((item) => {
    const matchCat = libCategory === 'all' || item.category === libCategory;
    const matchQuery =
      !libSearch.trim() ||
      item.model.toLowerCase().includes(libSearch.toLowerCase()) ||
      item.type.toLowerCase().includes(libSearch.toLowerCase()) ||
      item.description.toLowerCase().includes(libSearch.toLowerCase());
    return matchCat && matchQuery;
  });

  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).dataset.bg === 'true') {
      if (activeTool === 'annotate') {
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          const x = Math.round((e.clientX - rect.left - pan.x) / zoom);
          const y = Math.round((e.clientY - rect.top - pan.y) / zoom);
          onAddAnnotation('Subnet / VLAN Note', x, y);
          onSetTool('select');
        }
        return;
      }
      onSelectDevice(null);
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).dataset.bg === 'true') {
      onSelectDevice(null);
      setIsPanning(true);
      panStartRef.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (draggingDeviceId) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      let newX = (touch.clientX - rect.left - pan.x) / zoom - dragOffsetRef.current.x;
      let newY = (touch.clientY - rect.top - pan.y) / zoom - dragOffsetRef.current.y;
      if (snapToGrid) {
        newX = Math.round(newX / 24) * 24;
        newY = Math.round(newY / 24) * 24;
      }
      onMoveDevice(draggingDeviceId, Math.max(40, newX), Math.max(40, newY));
    } else if (isPanning) {
      setPan({
        x: touch.clientX - panStartRef.current.x,
        y: touch.clientY - panStartRef.current.y,
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingDeviceId) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      let newX = (e.clientX - rect.left - pan.x) / zoom - dragOffsetRef.current.x;
      let newY = (e.clientY - rect.top - pan.y) / zoom - dragOffsetRef.current.y;
      if (snapToGrid) {
        newX = Math.round(newX / 24) * 24;
        newY = Math.round(newY / 24) * 24;
      }
      onMoveDevice(draggingDeviceId, Math.max(40, newX), Math.max(40, newY));
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingDeviceId(null);
    setIsPanning(false);
  };

  const handleDeviceClick = (e: React.MouseEvent, dev: NetworkDevice) => {
    e.stopPropagation();
    setConnectionWarning(null);

    if (activeTool === 'delete') {
      onDeleteDevice(dev.id);
      return;
    }

    if (activeTool === 'connect') {
      if (!connectSourceDeviceId) {
        // Pick first available unconnected interface if only 1, otherwise open interface selector
        const freeInterfaces = dev.interfaces.filter((i) => !i.connectedLinkId);
        if (freeInterfaces.length === 0) {
          setConnectionWarning(`${dev.name} has no available unconnected interfaces.`);
          return;
        }
        setConnectSourceDeviceId(dev.id);
        setConnectSourceInterfaceId(freeInterfaces[0].id);
      } else if (connectSourceDeviceId === dev.id) {
        setConnectSourceDeviceId(null);
        setConnectSourceInterfaceId(null);
      } else {
        setConnectTargetDeviceId(dev.id);
      }
      return;
    }

    onSelectDevice(dev.id);
  };

  const handleCompleteConnection = (targetIfId: string) => {
    if (!connectSourceDeviceId || !connectSourceInterfaceId || !connectTargetDeviceId) return;
    const res = onCreateLink(
      connectSourceDeviceId,
      connectSourceInterfaceId,
      connectTargetDeviceId,
      targetIfId,
      preferredLinkType
    );
    if (!res.ok) {
      setConnectionWarning(res.error || 'Incompatible interface connection.');
    } else {
      setConnectionWarning(null);
      setConnectSourceDeviceId(null);
      setConnectSourceInterfaceId(null);
      setConnectTargetDeviceId(null);
      onSetTool('select');
    }
  };

  const handleFitToScreen = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const sourceConnectDev = project.devices.find((d) => d.id === connectSourceDeviceId);
  const targetConnectDev = project.devices.find((d) => d.id === connectTargetDeviceId);

  return (
    <div className="flex flex-1 h-full overflow-hidden relative bg-slate-950 text-slate-100">
      {/* Desktop Left Panel: Device Library */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-800 bg-slate-900/80 shrink-0">
        <div className="p-3 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold tracking-wide text-slate-300">Device Library</h2>
            <span className="text-xs text-slate-400 tabular-nums">{filteredCatalog.length} models</span>
          </div>
          <input
            type="search"
            value={libSearch}
            onChange={(e) => setLibSearch(e.target.value)}
            placeholder="Filter PCs, routers, switches..."
            aria-label="Filter devices in library"
            className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'end-devices', label: 'End' },
                { id: 'routers', label: 'Routers' },
                { id: 'switches', label: 'Switches' },
                { id: 'wireless', label: 'Wi-Fi' },
                { id: 'security-wan', label: 'WAN/Sec' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setLibCategory(tab.id)}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  libCategory === tab.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
          {filteredCatalog.map((tpl) => (
            <div
              key={tpl.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/netlab-device', tpl.type);
              }}
              onClick={() => onAddDevice(tpl)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onAddDevice(tpl);
                }
              }}
              className="group p-2.5 rounded-lg border border-slate-800/90 bg-slate-950/60 hover:border-cyan-500/50 hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-md bg-slate-900 text-cyan-400 border border-slate-800 group-hover:border-cyan-500/40 shrink-0">
                    <DeviceNodeSvg type={tpl.type} className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate">{tpl.model}</div>
                    <div className="text-[11px] text-slate-400 truncate">{tpl.interfaceSummary}</div>
                  </div>
                </div>
                <span className="text-[11px] text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  + Add
                </span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Center Workspace: Toolbar + Interactive SVG Topology Canvas */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Top Simulator Action & Mode Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/90 z-10">
          {/* Tool Selection */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setMobileLibOpen(true)}
              className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-cyan-500/20 text-cyan-300 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Add Device
            </button>
            {(
              [
                { id: 'select', label: 'Select / Move', icon: MousePointer },
                { id: 'connect', label: 'Connect Cable', icon: Cable },
                { id: 'annotate', label: 'Add Label', icon: StickyNote },
                { id: 'delete', label: 'Remove', icon: Trash2 },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    onSetTool(t.id);
                    setConnectSourceDeviceId(null);
                    setConnectTargetDeviceId(null);
                    setConnectionWarning(null);
                  }}
                  title={t.label}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeTool === t.id
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Cable Type Picker when Connect Tool is active */}
          {activeTool === 'connect' && (
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-cyan-500/40">
              <span className="text-[11px] text-cyan-300 font-medium whitespace-nowrap">Cable Type:</span>
              {(['ethernet', 'trunk', 'serial', 'fiber', 'wireless'] as const).map((lt) => (
                <button
                  key={lt}
                  onClick={() => setPreferredLinkType(lt)}
                  className={`px-2 py-0.5 text-[11px] rounded capitalize whitespace-nowrap shrink-0 ${
                    preferredLinkType === lt
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lt === 'trunk' ? '802.1Q Trunk' : lt}
                </button>
              ))}
            </div>
          )}

          {/* Quick Ping & Diagnostics Bar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="hidden xl:flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
              <select
                value={pingSourceId || selectedDeviceId || ''}
                onChange={(e) => setPingSourceId(e.target.value)}
                aria-label="Ping source device"
                className="bg-transparent text-xs text-slate-200 focus:outline-none"
              >
                <option value="" className="bg-slate-900">
                  From Device...
                </option>
                {project.devices.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900">
                    {d.name} ({d.interfaces[0]?.ipAddress || 'No IP'})
                  </option>
                ))}
              </select>
              <span className="text-slate-600">→</span>
              <input
                type="text"
                value={pingTargetInput}
                onChange={(e) => setPingTargetInput(e.target.value)}
                placeholder="Target IP or Host..."
                aria-label="Target IP or Hostname to ping"
                className="w-32 text-xs bg-slate-900 px-2 py-1 rounded border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => {
                  const src = pingSourceId || selectedDeviceId || project.devices[0]?.id;
                  const dst =
                    pingTargetInput.trim() ||
                    project.devices.find((d) => d.id !== src && d.interfaces[0]?.ipAddress)?.interfaces[0]
                      ?.ipAddress ||
                    '192.168.1.20';
                  if (src) onRunQuickPing(src, dst);
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-3 h-3" /> Send Ping
              </button>
            </div>

            {/* Realtime vs Step-by-Step Simulation Toggle */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => onSetSimulationMode('realtime')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  simulationMode === 'realtime'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Realtime
              </button>
              <button
                onClick={() => onSetSimulationMode('step')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  simulationMode === 'step'
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Step Simulation
              </button>
            </div>

            <button
              onClick={onRunDiagnostics}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Check Network
            </button>

            {onExportPdf && (
              <button
                onClick={onExportPdf}
                title="Export Visual Topology & Device Configurations to PDF"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors whitespace-nowrap shrink-0"
              >
                <FileDown className="w-3.5 h-3.5" /> Export PDF
              </button>
            )}
          </div>
        </div>

        {/* Step-by-Step Playback Control Bar when activeSimulation exists */}
        {activeSimulation && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900/95 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`inline-flex items-center gap-1 font-medium whitespace-nowrap ${
                  activeSimulation.overallSuccess ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {activeSimulation.overallSuccess ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                {activeSimulation.title}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300 truncate">{ currentStepEvent?.summary || activeSimulation.summaryMessage }</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <div className="hidden sm:flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 mr-1">
                <span className="text-[10px] text-slate-400">Speed:</span>
                {[0.5, 1, 2].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => onSetSimulationSpeed(spd)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      simulationSpeed === spd
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
              <span className="text-slate-400 font-mono tabular-nums mr-1">
                Step {Math.min(currentStepIndex + 1, activeSimulation.events.length)} / {activeSimulation.events.length}
              </span>
              <button
                onClick={onPlayPauseSteps}
                className="px-2.5 py-1 rounded bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition-colors whitespace-nowrap shrink-0"
              >
                {isPlayingSteps ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={onNextStep}
                disabled={currentStepIndex >= activeSimulation.events.length - 1}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
              >
                <StepForward className="w-3.5 h-3.5" /> Next Event
              </button>
              <button
                onClick={onResetSteps}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          </div>
        )}

        {/* Connection Helper / Warning Banner */}
        {(connectSourceDeviceId || connectionWarning) && (
          <div className="px-4 py-2.5 bg-slate-900 border-b border-cyan-500/40 flex flex-wrap items-center justify-between gap-2 text-xs z-20">
            {connectionWarning ? (
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{connectionWarning}</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-slate-200">
                <span className="font-medium text-cyan-300">
                  Connecting from {sourceConnectDev?.name}:
                </span>
                <select
                  value={connectSourceInterfaceId || ''}
                  onChange={(e) => setConnectSourceInterfaceId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono"
                >
                  {sourceConnectDev?.interfaces.map((intf) => (
                    <option key={intf.id} value={intf.id} disabled={!!intf.connectedLinkId}>
                      {intf.shortName} ({intf.mediaType}) {intf.connectedLinkId ? '[In Use]' : '[Free]'}
                    </option>
                  ))}
                </select>
                {!targetConnectDev ? (
                  <span className="text-slate-400">
                    → Now click the destination device on the canvas.
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>→ Destination {targetConnectDev.name} interface:</span>
                    <div className="flex flex-wrap gap-1">
                      {targetConnectDev.interfaces.map((tIntf) => (
                        <button
                          key={tIntf.id}
                          disabled={!!tIntf.connectedLinkId}
                          onClick={() => handleCompleteConnection(tIntf.id)}
                          className="px-2 py-1 rounded bg-cyan-500 text-slate-950 font-mono font-semibold hover:bg-cyan-400 disabled:opacity-30 disabled:bg-slate-800 disabled:text-slate-500 whitespace-nowrap"
                        >
                          {tIntf.shortName} ({tIntf.mediaType})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => {
                setConnectSourceDeviceId(null);
                setConnectTargetDeviceId(null);
                setConnectionWarning(null);
              }}
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Interactive SVG Canvas */}
        <div
          className="flex-1 relative overflow-hidden canvas-grid-dark select-none touch-none"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('application/netlab-device') as DeviceType;
            const tpl = DEVICE_CATALOG.find((t) => t.type === type);
            if (tpl && svgRef.current) {
              const rect = svgRef.current.getBoundingClientRect();
              const x = Math.round((e.clientX - rect.left - pan.x) / zoom);
              const y = Math.round((e.clientY - rect.top - pan.y) / zoom);
              onAddDevice(tpl, x, y);
            }
          }}
        >
          <svg
            ref={svgRef}
            data-bg="true"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleCanvasTouchMove}
            onTouchEnd={handleCanvasMouseUp}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          >
            <defs>
              {/* Liquid Glass Node Drop Shadow & Specular Gradient */}
              <filter id="glassNodeShadow" x="-25%" y="-25%" width="150%" height="160%">
                <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#020617" floodOpacity="0.42" />
              </filter>
              <filter id="packetGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#22d3ee" floodOpacity="0.65" />
              </filter>
              <linearGradient id="glassBevelOverlay" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                <stop offset="45%" stopColor="#ffffff" stopOpacity="0.03" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
              </linearGradient>
            </defs>
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Render Network Cables / Links */}
              {project.links.map((link) => {
                const src = project.devices.find((d) => d.id === link.sourceDeviceId);
                const dst = project.devices.find((d) => d.id === link.targetDeviceId);
                if (!src || !dst) return null;

                const srcIf = src.interfaces.find((i) => i.id === link.sourceInterfaceId);
                const dstIf = dst.interfaces.find((i) => i.id === link.targetInterfaceId);

                const isHighlightedLink =
                  currentStepEvent &&
                  ((currentStepEvent.fromDeviceId === src.id && currentStepEvent.toDeviceId === dst.id) ||
                    (currentStepEvent.fromDeviceId === dst.id && currentStepEvent.toDeviceId === src.id));

                const strokeColor = isHighlightedLink
                  ? '#22d3ee'
                  : link.status === 'up'
                  ? link.type === 'trunk'
                    ? '#38bdf8'
                    : link.type === 'serial'
                    ? '#f59e0b'
                    : '#10b981'
                  : '#ef4444';

                const midX = (src.x + dst.x) / 2;
                const midY = (src.y + dst.y) / 2;

                // Calculate interface label positions 32% along the line from each endpoint
                const srcLabelX = src.x + (dst.x - src.x) * 0.28;
                const srcLabelY = src.y + (dst.y - src.y) * 0.28;
                const dstLabelX = dst.x + (src.x - dst.x) * 0.28;
                const dstLabelY = dst.y + (src.y - dst.y) * 0.28;

                return (
                  <g key={link.id} className="group">
                    {/* Invisible wider hit target for deleting links */}
                    <line
                      x1={src.x}
                      y1={src.y}
                      x2={dst.x}
                      y2={dst.y}
                      stroke="transparent"
                      strokeWidth={14}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeTool === 'delete') {
                          onDeleteLink(link.id);
                        }
                      }}
                    />

                    {/* Main Cable Line */}
                    <line
                      x1={src.x}
                      y1={src.y}
                      x2={dst.x}
                      y2={dst.y}
                      stroke={strokeColor}
                      strokeWidth={isHighlightedLink ? 3.5 : link.type === 'trunk' ? 2.5 : 2}
                      strokeDasharray={
                        link.type === 'wireless'
                          ? '4 4'
                          : link.type === 'trunk'
                          ? '8 3'
                          : link.status === 'down'
                          ? '5 5'
                          : undefined
                      }
                    />

                    {/* Animated Signal Stream Overlay when Packet is Traversing Link */}
                    {isHighlightedLink && (
                      <line
                        x1={currentStepEvent?.fromDeviceId === src.id ? src.x : dst.x}
                        y1={currentStepEvent?.fromDeviceId === src.id ? src.y : dst.y}
                        x2={currentStepEvent?.fromDeviceId === src.id ? dst.x : src.x}
                        y2={currentStepEvent?.fromDeviceId === src.id ? dst.y : src.y}
                        stroke="#ffffff"
                        strokeOpacity={0.75}
                        strokeWidth={2.5}
                        strokeDasharray="6 12"
                        className="animate-signal-flow pointer-events-none"
                      />
                    )}

                    {/* Link Type / Status Indicator at Midpoint */}
                    {link.type === 'trunk' && (
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x={-24}
                          y={-9}
                          width={48}
                          height={18}
                          rx={4}
                          className="fill-slate-900 stroke-sky-500/50"
                          strokeWidth={1}
                        />
                        <text
                          textAnchor="middle"
                          dy="3"
                          className="fill-sky-300 text-[9px] font-mono font-medium"
                        >
                          802.1Q
                        </text>
                      </g>
                    )}

                    {/* Interface Port Labels & LED Triangles/Circles */}
                    {showInterfaceLabels && srcIf && (
                      <g transform={`translate(${srcLabelX}, ${srcLabelY})`}>
                        <rect
                          x={-22}
                          y={-9}
                          width={44}
                          height={18}
                          rx={4}
                          className="fill-slate-900/95 stroke-slate-700"
                          strokeWidth={1}
                        />
                        <text
                          textAnchor="middle"
                          dy="3"
                          className="fill-slate-200 text-[9px] font-mono"
                        >
                          {srcIf.shortName}
                        </text>
                      </g>
                    )}

                    {showInterfaceLabels && dstIf && (
                      <g transform={`translate(${dstLabelX}, ${dstLabelY})`}>
                        <rect
                          x={-22}
                          y={-9}
                          width={44}
                          height={18}
                          rx={4}
                          className="fill-slate-900/95 stroke-slate-700"
                          strokeWidth={1}
                        />
                        <text
                          textAnchor="middle"
                          dy="3"
                          className="fill-slate-200 text-[9px] font-mono"
                        >
                          {dstIf.shortName}
                        </text>
                      </g>
                    )}

                    {/* Animated Packet Envelope Gliding from Sender to Receiver */}
                    {isHighlightedLink && currentStepEvent && (() => {
                      const fromIsSrc = currentStepEvent.fromDeviceId === src.id;
                      const startX = fromIsSrc ? src.x : dst.x;
                      const startY = fromIsSrc ? src.y : dst.y;
                      const endX = fromIsSrc ? dst.x : src.x;
                      const endY = fromIsSrc ? dst.y : src.y;
                      const pktX = startX + (endX - startX) * packetTravelProgress;
                      const pktY = startY + (endY - startY) * packetTravelProgress;

                      return (
                        <g
                          transform={`translate(${pktX}, ${pktY - 16})`}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <circle
                            cx={0}
                            cy={16}
                            r={5}
                            className="fill-cyan-300"
                          />
                          <rect
                            x={-42}
                            y={-13}
                            width={84}
                            height={24}
                            rx={8}
                            filter="url(#packetGlow)"
                            className={
                              currentStepEvent.status === 'error'
                                ? 'fill-rose-600 stroke-rose-200'
                                : currentStepEvent.protocol === 'ARP'
                                ? 'fill-amber-500 stroke-amber-100'
                                : 'fill-cyan-500 stroke-white'
                            }
                            strokeWidth={1.5}
                          />
                          <text
                            textAnchor="middle"
                            dy="3"
                            style={{
                              fill:
                                currentStepEvent.status === 'error' ? '#ffffff' : '#020617',
                            }}
                            className="text-[10px] font-mono font-bold"
                          >
                            {currentStepEvent.protocol} {currentStepEvent.action === 'reply' ? '↩' : '→'}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })}

              {/* Render Canvas Annotations */}
              {project.annotations.map((ann) => (
                <g
                  key={ann.id}
                  transform={`translate(${ann.x}, ${ann.y})`}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'delete') {
                      onDeleteAnnotation(ann.id);
                    } else {
                      setEditingAnnotationId(ann.id);
                      setEditingAnnotationText(ann.text);
                    }
                  }}
                >
                  <rect
                    x={0}
                    y={0}
                    width={Math.max(180, ann.text.length * 6.4)}
                    height={28}
                    rx={6}
                    className="fill-slate-900/90 stroke-slate-700 hover:stroke-cyan-500"
                    strokeWidth={1}
                  />
                  <text x={10} y={18} className="fill-cyan-300 text-[11px] font-medium">
                    {ann.text}
                  </text>
                  {activeTool === 'delete' && (
                    <g
                      transform={`translate(${Math.max(180, ann.text.length * 6.4) - 18}, 6)`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAnnotation(ann.id);
                      }}
                    >
                      <text className="fill-rose-400 text-xs font-bold">×</text>
                    </g>
                  )}
                </g>
              ))}

              {/* Render Network Devices */}
              {project.devices.map((dev) => {
                const isSelected = selectedDeviceId === dev.id;
                const isConnectSrc = connectSourceDeviceId === dev.id;
                const isPacketActive =
                  currentStepEvent &&
                  (currentStepEvent.fromDeviceId === dev.id || currentStepEvent.toDeviceId === dev.id);

                const primaryIp = dev.interfaces.find((i) => i.ipAddress)?.ipAddress;
                const anyUp = dev.interfaces.some((i) => i.adminUp && i.lineProtocolUp);

                return (
                  <g
                    key={dev.id}
                    transform={`translate(${dev.x}, ${dev.y})`}
                    onMouseDown={(e) => {
                      if (activeTool === 'select') {
                        e.stopPropagation();
                        onSelectDevice(dev.id);
                        const rect = svgRef.current?.getBoundingClientRect();
                        if (rect) {
                          setDraggingDeviceId(dev.id);
                          dragOffsetRef.current = {
                            x: (e.clientX - rect.left - pan.x) / zoom - dev.x,
                            y: (e.clientY - rect.top - pan.y) / zoom - dev.y,
                          };
                        }
                      }
                    }}
                    onTouchStart={(e) => {
                      if (activeTool === 'select' && e.touches.length === 1) {
                        e.stopPropagation();
                        const touch = e.touches[0];
                        onSelectDevice(dev.id);
                        const rect = svgRef.current?.getBoundingClientRect();
                        if (rect) {
                          setDraggingDeviceId(dev.id);
                          dragOffsetRef.current = {
                            x: (touch.clientX - rect.left - pan.x) / zoom - dev.x,
                            y: (touch.clientY - rect.top - pan.y) / zoom - dev.y,
                          };
                        }
                      }
                    }}
                    onClick={(e) => handleDeviceClick(e, dev)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (dev.type === 'pc' || dev.type === 'laptop' || dev.type === 'server') {
                        onOpenDesktopModal(dev.id);
                      } else {
                        onOpenCliForDevice(dev.id);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {/* Selection or Active Packet Highlight Ring */}
                    {isPacketActive && (
                      <rect
                        x={-36}
                        y={-36}
                        width={72}
                        height={72}
                        rx={18}
                        fill="none"
                        stroke={currentStepEvent?.status === 'error' ? '#f43f5e' : '#22d3ee'}
                        strokeWidth={2}
                        className="animate-radar-ripple pointer-events-none"
                      />
                    )}
                    {(isSelected || isConnectSrc || isPacketActive) && (
                      <rect
                        x={-34}
                        y={-34}
                        width={68}
                        height={68}
                        rx={16}
                        fill="none"
                        stroke={
                          isPacketActive
                            ? currentStepEvent?.status === 'error'
                              ? '#f43f5e'
                              : '#22d3ee'
                            : '#06b6d4'
                        }
                        strokeWidth={2}
                        strokeDasharray={isConnectSrc ? '4 4' : undefined}
                      />
                    )}

                    {/* Device Chassis Node */}
                    <rect
                      x={-28}
                      y={-28}
                      width={56}
                      height={56}
                      rx={14}
                      filter="url(#glassNodeShadow)"
                      className={`${
                        isSelected
                          ? 'fill-slate-800 stroke-cyan-400'
                          : 'fill-slate-900 stroke-slate-700 hover:stroke-cyan-500/60'
                      }`}
                      strokeWidth={1.75}
                    />

                    {/* Liquid Glass Top Specular Sheen Overlay */}
                    <rect
                      x={-27}
                      y={-27}
                      width={54}
                      height={54}
                      rx={13}
                      fill="url(#glassBevelOverlay)"
                      className="pointer-events-none"
                    />

                    {/* Embedded Device Vector Icon */}
                    <foreignObject x={-14} y={-14} width={28} height={28} className="pointer-events-none">
                      <div className="w-full h-full flex items-center justify-center text-cyan-400">
                        <DeviceNodeSvg type={dev.type} className="w-6 h-6" />
                      </div>
                    </foreignObject>

                    {/* Operational Status Badge (Text + Color) */}
                    <rect
                      x={10}
                      y={-31}
                      width={24}
                      height={14}
                      rx={5}
                      className={anyUp ? 'fill-emerald-600' : 'fill-slate-700'}
                    />
                    <text
                      x={22}
                      y={-21.5}
                      textAnchor="middle"
                      style={{ fill: '#ffffff' }}
                      className="text-[8px] font-mono font-bold"
                    >
                      {anyUp ? 'UP' : 'OFF'}
                    </text>

                    {/* Device Hostname Label */}
                    <text
                      y={43}
                      textAnchor="middle"
                      className="fill-slate-100 text-xs font-bold tracking-tight"
                    >
                      {dev.name}
                    </text>

                    {/* Primary IPv4 Subtitle */}
                    {primaryIp && (
                      <text
                        y={57}
                        textAnchor="middle"
                        className="fill-slate-400 text-[10px] font-mono font-medium"
                      >
                        {primaryIp}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Bottom-Left Canvas Viewport Controls (Liquid Glass Dock) */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1 liquid-glass bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl shadow-xl">
            <button
              onClick={() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)))}
              title="Zoom In"
              aria-label="Zoom In"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="px-1.5 text-[11px] font-mono text-slate-400 tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.max(0.45, +(z - 0.15).toFixed(2)))}
              title="Zoom Out"
              aria-label="Zoom Out"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleFitToScreen}
              title="Reset Zoom & Fit Canvas"
              aria-label="Reset Zoom"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-800 mx-0.5" />
            <button
              onClick={onToggleSnapToGrid}
              title="Toggle Snap to Grid"
              className={`px-2 py-1 text-[11px] font-medium rounded flex items-center gap-1 ${
                snapToGrid ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5" /> Grid
            </button>
            <button
              onClick={() => setShowInterfaceLabels((v) => !v)}
              className={`px-2 py-1 text-[11px] font-medium rounded ${
                showInterfaceLabels ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ports
            </button>
            <div className="w-px h-4 bg-slate-800 mx-0.5" />
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo"
              aria-label="Undo"
              className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 rounded"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo"
              aria-label="Redo"
              className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 rounded"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Inline Annotation Edit Popover */}
          {editingAnnotationId && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl flex items-center gap-2 text-xs">
              <input
                type="text"
                value={editingAnnotationText}
                onChange={(e) => setEditingAnnotationText(e.target.value)}
                aria-label="Edit canvas label text"
                className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100 w-64 focus:outline-none focus:border-cyan-500"
                autoFocus
              />
              <button
                onClick={() => {
                  if (editingAnnotationText.trim()) {
                    onUpdateAnnotation(editingAnnotationId, editingAnnotationText.trim());
                  }
                  setEditingAnnotationId(null);
                }}
                className="px-3 py-1.5 rounded bg-cyan-500 text-slate-950 font-semibold"
              >
                Save Label
              </button>
              <button
                onClick={() => {
                  onDeleteAnnotation(editingAnnotationId);
                  setEditingAnnotationId(null);
                }}
                className="px-2.5 py-1.5 rounded bg-rose-600 text-white font-medium"
              >
                Delete
              </button>
              <button
                onClick={() => setEditingAnnotationId(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Contextual Floating Quick Actions for Selected Device */}
          {selectedDeviceId && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 liquid-glass bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl shadow-xl">
              <span className="text-xs font-semibold text-cyan-300 mr-1">
                {project.devices.find((d) => d.id === selectedDeviceId)?.name}
              </span>
              {onOpenMobileInspector && (
                <button
                  onClick={onOpenMobileInspector}
                  className="xl:hidden flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-cyan-500 text-slate-950 font-semibold whitespace-nowrap"
                >
                  <Sliders className="w-3.5 h-3.5" /> Configure
                </button>
              )}
              <button
                onClick={() => onOpenCliForDevice(selectedDeviceId)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-100 whitespace-nowrap"
              >
                <Terminal className="w-3.5 h-3.5 text-cyan-400" /> CLI
              </button>
              {['pc', 'laptop', 'server'].includes(
                project.devices.find((d) => d.id === selectedDeviceId)?.type || ''
              ) && (
                <button
                  onClick={() => onOpenDesktopModal(selectedDeviceId)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-100 whitespace-nowrap"
                >
                  <Monitor className="w-3.5 h-3.5 text-emerald-400" /> Desktop Apps
                </button>
              )}
              <button
                onClick={() => onDuplicateDevice(selectedDeviceId)}
                title="Duplicate Device"
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDeleteDevice(selectedDeviceId)}
                title="Delete Device"
                className="p-1 text-rose-400 hover:text-rose-300 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile / Tablet Drawer for Device Library */}
      {mobileLibOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex lg:hidden">
          <div className="w-72 max-w-full bg-slate-900 h-full flex flex-col border-r border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Tap Device to Add</h3>
              <button
                onClick={() => setMobileLibOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {DEVICE_CATALOG.map((tpl) => (
                <button
                  key={tpl.type}
                  onClick={() => {
                    onAddDevice(tpl);
                    setMobileLibOpen(false);
                  }}
                  className="w-full text-left p-3 rounded-lg border border-slate-800 bg-slate-950 hover:border-cyan-500/40 flex items-center gap-3"
                >
                  <div className="p-2 rounded bg-slate-900 text-cyan-400">
                    <DeviceNodeSvg type={tpl.type} className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">{tpl.model}</div>
                    <div className="text-[11px] text-slate-400">{tpl.interfaceSummary}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

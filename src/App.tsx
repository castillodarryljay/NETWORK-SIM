import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Network,
  BookOpen,
  FlaskConical,
  Wrench,
  FolderOpen,
  Cpu,
  Calculator,
  Award,
  Settings,
  Save,
  Menu,
  X,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import {
  CliSessionState,
  DeviceModelTemplate,
  DiagnosticIssue,
  LinkType,
  NetworkDevice,
  NetworkLink,
  NetworkProject,
  SimulationSession,
} from './types/network';
import { createDeviceFromTemplate } from './utils/networkMath';
import {
  requestDhcpLease,
  runNetworkDiagnostics,
  runPacketSimulation,
  synchronizeNetworkState,
} from './engine/simulationEngine';
import { executeCliCommand } from './engine/cliParser';
import {
  CanvasTool,
  NavSection,
  StudentProgressState,
  autosaveCurrentProject,
  loadInitialProject,
  loadSavedProjects,
  loadStudentProgress,
  loadThemePreference,
  saveProjectsToStorage,
  saveStudentProgress,
  saveThemePreference,
  validateAndMigrateProjectJson,
} from './store/persistence';
import { GUIDED_LABS, TROUBLESHOOTING_CHALLENGES } from './data/labsAndChallenges';
import { TopologyCanvas } from './components/TopologyCanvas';
import { DeviceInspector } from './components/DeviceInspector';
import { BottomWorkspaceDock } from './components/BottomWorkspaceDock';
import { DeviceDesktopModal } from './components/DeviceDesktopModal';
import { DashboardAndProjects } from './components/DashboardAndProjects';
import { LearningAndToolsViews } from './components/LearningAndToolsViews';
import { exportTopologyToPdf } from './utils/pdfExport';

const NAV_ITEMS: { id: NavSection; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { id: 'simulator', label: 'Network Simulator', shortLabel: 'Simulator', icon: Network },
  { id: 'learning', label: 'Learning Center', shortLabel: 'Learn', icon: BookOpen },
  { id: 'labs', label: 'Guided Labs', shortLabel: 'Labs', icon: FlaskConical },
  { id: 'challenges', label: 'Practice Challenges', shortLabel: 'Challenges', icon: Wrench },
  { id: 'projects', label: 'My Projects', shortLabel: 'Projects', icon: FolderOpen },
  { id: 'reference', label: 'Device Reference', shortLabel: 'Devices', icon: Cpu },
  { id: 'subnet-calc', label: 'Subnet Calculator', shortLabel: 'Subnet', icon: Calculator },
  { id: 'progress', label: 'Progress', shortLabel: 'Progress', icon: Award },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
];

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSection>('simulator');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => loadThemePreference());

  // Core Project & Undo/Redo History State
  const [currentProject, setCurrentProject] = useState<NetworkProject>(() => loadInitialProject());
  const [undoStack, setUndoStack] = useState<NetworkProject[]>([]);
  const [redoStack, setRedoStack] = useState<NetworkProject[]>([]);
  const [unsavedChanges, setUnsavedChanges] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const [savedProjects, setSavedProjects] = useState<NetworkProject[]>(() => loadSavedProjects());
  const [progress, setProgress] = useState<StudentProgressState>(() => loadStudentProgress());

  // Simulator Workspace UI States
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(() => {
    const init = loadInitialProject();
    return init.devices[0]?.id || null;
  });
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [desktopModalDeviceId, setDesktopModalDeviceId] = useState<string | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState<boolean>(false);

  // Bottom Dock (CLI, Packet Events, Diagnostics)
  const [bottomDockOpen, setBottomDockOpen] = useState<boolean>(true);
  const [bottomDockTab, setBottomDockTab] = useState<'cli' | 'packets' | 'diagnostics'>('cli');
  const [cliSessions, setCliSessions] = useState<Record<string, CliSessionState>>({});

  // Packet Simulation & Step Playback States
  const [simulationMode, setSimulationMode] = useState<'realtime' | 'step'>('realtime');
  const [activeSimulation, setActiveSimulation] = useState<SimulationSession | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlayingSteps, setIsPlayingSteps] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);

  // Diagnostics State
  const [diagnosticIssues, setDiagnosticIssues] = useState<DiagnosticIssue[]>([]);

  // Learning Center Selected Lesson
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>('les-osi-tcpip');

  // Mobile Navigation Drawer
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    saveThemePreference(theme);
  }, [theme]);

  // Autosave currentProject whenever it changes
  useEffect(() => {
    autosaveCurrentProject(currentProject);
  }, [currentProject]);

  // Save student progress whenever it changes
  useEffect(() => {
    saveStudentProgress(progress);
  }, [progress]);

  // Step-by-step packet playback timer
  useEffect(() => {
    if (!isPlayingSteps || !activeSimulation) return;
    const intervalMs = Math.max(320, Math.round(900 / simulationSpeed));
    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev >= activeSimulation.events.length - 1) {
          setIsPlayingSteps(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isPlayingSteps, activeSimulation, simulationSpeed]);

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3200);
  };

  const commitProjectUpdate = (nextProject: NetworkProject, recordUndo = true) => {
    if (recordUndo) {
      setUndoStack((prev) => [...prev.slice(-19), currentProject]);
      setRedoStack([]);
    }
    const synced = synchronizeNetworkState(nextProject.devices, nextProject.links);
    const updated: NetworkProject = {
      ...nextProject,
      updatedAt: new Date().toISOString(),
      devices: synced.devices,
      links: synced.links,
    };
    setCurrentProject(updated);
    setUnsavedChanges(true);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [currentProject, ...r]);
    setUndoStack((u) => u.slice(0, -1));
    setCurrentProject(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setUndoStack((u) => [...u, currentProject]);
    setRedoStack((r) => r.slice(1));
    setCurrentProject(next);
  };

  // Topology Canvas Handlers
  const handleAddDevice = (template: DeviceModelTemplate, x?: number, y?: number) => {
    const sameTypeCount = currentProject.devices.filter((d) => d.type === template.type).length + 1;
    const posX = x ?? 200 + ((currentProject.devices.length * 70) % 520);
    const posY = y ?? 180 + ((currentProject.devices.length * 55) % 240);
    const newDev = createDeviceFromTemplate(template, sameTypeCount, posX, posY);

    commitProjectUpdate({
      ...currentProject,
      devices: [...currentProject.devices, newDev],
    });
    setSelectedDeviceId(newDev.id);

    setProgress((p) => ({
      ...p,
      onboardingChecklist: { ...p.onboardingChecklist, addedDevice: true },
    }));
  };

  const handleMoveDevice = (id: string, x: number, y: number) => {
    setCurrentProject((prev) => ({
      ...prev,
      devices: prev.devices.map((d) => (d.id === id ? { ...d, x, y } : d)),
    }));
  };

  const handleDeleteDevice = (id: string) => {
    commitProjectUpdate({
      ...currentProject,
      devices: currentProject.devices.filter((d) => d.id !== id),
      links: currentProject.links.filter(
        (l) => l.sourceDeviceId !== id && l.targetDeviceId !== id
      ),
    });
    if (selectedDeviceId === id) setSelectedDeviceId(null);
  };

  const handleDuplicateDevice = (id: string) => {
    const orig = currentProject.devices.find((d) => d.id === id);
    if (!orig) return;
    const copyId = `dev-${orig.type}-${Date.now()}`;
    const copy: NetworkDevice = {
      ...JSON.parse(JSON.stringify(orig)),
      id: copyId,
      name: `${orig.name}-Copy`,
      hostname: `${orig.hostname}-Copy`,
      x: orig.x + 64,
      y: orig.y + 48,
      interfaces: orig.interfaces.map((intf, idx) => ({
        ...intf,
        id: `${copyId}-if-${idx}`,
        ipAddress: '',
        connectedLinkId: undefined,
        lineProtocolUp: false,
      })),
    };
    commitProjectUpdate({
      ...currentProject,
      devices: [...currentProject.devices, copy],
    });
    setSelectedDeviceId(copy.id);
  };

  const handleCreateLink = (
    srcDevId: string,
    srcIfId: string,
    dstDevId: string,
    dstIfId: string,
    linkType: LinkType
  ): { ok: boolean; error?: string } => {
    const srcDev = currentProject.devices.find((d) => d.id === srcDevId);
    const dstDev = currentProject.devices.find((d) => d.id === dstDevId);
    const srcIf = srcDev?.interfaces.find((i) => i.id === srcIfId);
    const dstIf = dstDev?.interfaces.find((i) => i.id === dstIfId);

    if (!srcDev || !dstDev || !srcIf || !dstIf) {
      return { ok: false, error: 'Selected device or interface not found.' };
    }
    if (srcIf.connectedLinkId || dstIf.connectedLinkId) {
      return { ok: false, error: 'One of the selected interfaces already has a cable attached.' };
    }
    if (srcIf.mediaType !== dstIf.mediaType) {
      return {
        ok: false,
        error: `Incompatible physical media: Cannot connect ${srcDev.name} ${srcIf.shortName} (${srcIf.mediaType.toUpperCase()}) to ${dstDev.name} ${dstIf.shortName} (${dstIf.mediaType.toUpperCase()}). Choose matching interface types.`,
      };
    }

    const actualLinkType: LinkType =
      srcIf.mediaType === 'serial'
        ? 'serial'
        : srcIf.mediaType === 'fiber'
        ? 'fiber'
        : srcIf.mediaType === 'wireless'
        ? 'wireless'
        : linkType === 'trunk'
        ? 'trunk'
        : 'ethernet';

    const updatedDevices = currentProject.devices.map((d) => {
      if (d.id !== srcDevId && d.id !== dstDevId) return d;
      return {
        ...d,
        interfaces: d.interfaces.map((i) => {
          if (i.id === srcIfId || i.id === dstIfId) {
            return {
              ...i,
              switchportMode:
                actualLinkType === 'trunk' && (d.type === 'l2-switch' || d.type === 'l3-switch')
                  ? 'trunk'
                  : i.switchportMode,
            };
          }
          return i;
        }),
      };
    });

    const newLink: NetworkLink = {
      id: `link-${Date.now()}`,
      sourceDeviceId: srcDevId,
      sourceInterfaceId: srcIfId,
      targetDeviceId: dstDevId,
      targetInterfaceId: dstIfId,
      type: actualLinkType,
      status: 'up',
    };

    commitProjectUpdate({
      ...currentProject,
      devices: updatedDevices,
      links: [...currentProject.links, newLink],
    });

    setProgress((p) => ({
      ...p,
      onboardingChecklist: { ...p.onboardingChecklist, connectedCable: true },
    }));

    return { ok: true };
  };

  const handleDeleteLink = (linkId: string) => {
    commitProjectUpdate({
      ...currentProject,
      links: currentProject.links.filter((l) => l.id !== linkId),
    });
  };

  const handleUpdateDevice = (updated: NetworkDevice) => {
    commitProjectUpdate({
      ...currentProject,
      devices: currentProject.devices.map((d) => (d.id === updated.id ? updated : d)),
    });
    setProgress((p) => ({
      ...p,
      onboardingChecklist: { ...p.onboardingChecklist, configuredIp: true },
    }));
  };

  const handleRequestDhcp = (deviceId: string) => {
    const res = requestDhcpLease(deviceId, currentProject.devices, currentProject.links);
    commitProjectUpdate({
      ...currentProject,
      devices: res.updatedDevices,
    });
    showToast(res.message);
  };

  const handleRunQuickPing = (srcDeviceId: string, targetIp: string) => {
    const simResult = runPacketSimulation(
      srcDeviceId,
      targetIp,
      'ICMP',
      currentProject.devices,
      currentProject.links
    );
    commitProjectUpdate(
      {
        ...currentProject,
        devices: simResult.updatedDevices,
      },
      false
    );
    setActiveSimulation(simResult.session);
    setCurrentStepIndex(0);
    if (simulationMode === 'realtime') {
      // Automatically animate through all packet hops in Realtime mode
      setSimulationSpeed(2);
      setIsPlayingSteps(true);
    } else {
      setIsPlayingSteps(true);
    }
    setBottomDockOpen(true);
    setBottomDockTab('packets');

    setProgress((p) => ({
      ...p,
      simulationsRun: p.simulationsRun + 1,
      onboardingChecklist: { ...p.onboardingChecklist, testedPing: true },
    }));
  };

  const handleExecuteCliCommand = (deviceId: string, command: string) => {
    const dev = currentProject.devices.find((d) => d.id === deviceId);
    if (!dev) return;

    const existingSession: CliSessionState = cliSessions[deviceId] || {
      mode: ['pc', 'laptop', 'server', 'printer'].includes(dev.type) ? 'pc_shell' : 'user_exec',
      history: [],
      outputLines: [
        {
          id: 'init',
          text: `${dev.model} Console Ready. Type "?" or "help" for available commands.`,
          type: 'info',
        },
      ],
    };

    const res = executeCliCommand(
      command,
      deviceId,
      existingSession,
      currentProject.devices,
      currentProject.links
    );

    setCliSessions((prev) => ({
      ...prev,
      [deviceId]: res.updatedSession,
    }));

    commitProjectUpdate(
      {
        ...currentProject,
        devices: res.updatedDevices,
      },
      false
    );

    if (res.triggeredSimulation) {
      setActiveSimulation(res.triggeredSimulation);
      setCurrentStepIndex(0);
      setIsPlayingSteps(true);
    }

    setProgress((p) => ({
      ...p,
      cliCommandsExecuted: p.cliCommandsExecuted + 1,
      onboardingChecklist: { ...p.onboardingChecklist, usedCli: true },
    }));
  };

  const handleRunDiagnostics = () => {
    const issues = runNetworkDiagnostics(currentProject.devices, currentProject.links);
    setDiagnosticIssues(issues);
    setBottomDockOpen(true);
    setBottomDockTab('diagnostics');
  };

  // Project Management Actions
  const handleSaveCurrentProject = () => {
    const exists = savedProjects.some((p) => p.id === currentProject.id);
    const updatedList = exists
      ? savedProjects.map((p) => (p.id === currentProject.id ? currentProject : p))
      : [currentProject, ...savedProjects];

    const ok = saveProjectsToStorage(updatedList);
    if (ok) {
      setSavedProjects(updatedList);
      setUnsavedChanges(false);
      showToast(`Project "${currentProject.name}" saved to local storage.`);
    } else {
      showToast('Failed to save project: browser storage quota exceeded.');
    }
  };

  const handleCreateNewProject = (name: string, description: string) => {
    const blank: NetworkProject = {
      id: `proj-${Date.now()}`,
      version: '1.0.0',
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      devices: [],
      links: [],
      annotations: [],
    };
    setCurrentProject(blank);
    setSavedProjects((prev) => {
      const next = [blank, ...prev];
      saveProjectsToStorage(next);
      return next;
    });
    setUnsavedChanges(false);
    setActiveNav('simulator');
    showToast(`Created new blank topology "${name}".`);
  };

  const handleExportProject = (proj: NetworkProject) => {
    const blob = new Blob([JSON.stringify(proj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proj.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.netlab.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = (proj: NetworkProject = currentProject) => {
    exportTopologyToPdf(proj);
    showToast(`Exported "${proj.name}" topology & device configurations to PDF.`);
  };

  const handleImportProjectFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const res = validateAndMigrateProjectJson(parsed);
        if (!res.valid || !res.project) {
          showToast(res.error || 'Invalid project JSON file.');
          return;
        }
        setCurrentProject(res.project);
        setSavedProjects((prev) => {
          const next = [res.project!, ...prev.filter((p) => p.id !== res.project!.id)];
          saveProjectsToStorage(next);
          return next;
        });
        setActiveNav('simulator');
        showToast(`Imported project "${res.project.name}" successfully.`);
      } catch {
        showToast('Could not parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const selectedDevice = currentProject.devices.find((d) => d.id === selectedDeviceId) || null;
  const desktopModalDevice =
    currentProject.devices.find((d) => d.id === desktopModalDeviceId) || null;

  return (
    <div
      className={`min-h-screen h-screen flex flex-col overflow-hidden ${
        theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (Concise Nav Links) — Zone 3 (1 Primary Action) */}
      <header className="h-14 px-4 sm:px-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-8 shrink-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#simulator"
          onClick={(e) => {
            e.preventDefault();
            setActiveNav('simulator');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          NetLab Simulator <span className="text-xs font-mono font-semibold text-cyan-400 ml-1">by SHIRO</span>
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
          {(
            [
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'simulator', label: 'Simulator' },
              { id: 'learning', label: 'Learning Center' },
              { id: 'labs', label: 'Guided Labs' },
              { id: 'subnet-calc', label: 'Subnet Calculator' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeNav === item.id
                  ? 'text-cyan-400 underline underline-offset-8 decoration-2 decoration-cyan-400 font-semibold'
                  : ''
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSaveCurrentProject}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-500 rounded-lg hover:bg-cyan-400 transition-colors whitespace-nowrap shrink-0"
          >
            {unsavedChanges ? 'Save Project *' : 'Save Project'}
          </button>
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Open navigation menu"
            className="md:hidden p-1.5 text-slate-300 hover:text-white rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Compact Left Navigation Rail (All 10 Destinations Accessible in 1 Click) */}
        <nav
          aria-label="Primary Sidebar Navigation"
          className="hidden md:flex flex-col w-48 border-r border-slate-800 bg-slate-950 p-2.5 justify-between shrink-0"
        >
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Project Status & Quick Theme Toggle Card at bottom of sidebar */}
          <div className="space-y-2">
            <button
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/70 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors"
            >
              <span>Theme Mode</span>
              <span className="font-mono text-[11px] text-cyan-400">
                {theme === 'dark' ? 'Dark' : 'Light'}
              </span>
            </button>
            <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800/90 text-[11px] space-y-1">
              <div className="text-slate-400">Active Topology</div>
              <div className="font-semibold text-slate-200 truncate">{currentProject.name}</div>
              <div className="text-slate-400 font-mono tabular-nums">
                {currentProject.devices.length} devices · {currentProject.links.length} cables
              </div>
              <div className="pt-1.5 mt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Created by</span>
                <span className="font-mono font-bold text-cyan-400 tracking-wider">SHIRO</span>
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 flex md:hidden">
            <div className="w-64 bg-slate-950 border-r border-slate-800 h-full p-4 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
                  <div>
                    <span className="font-bold text-sm text-white block">NetLab Simulator</span>
                    <span className="font-mono text-[10px] text-cyan-400 font-semibold">Made by SHIRO</span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveNav(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium ${
                        activeNav === item.id
                          ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                          : 'text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-800 bg-slate-900 text-xs font-medium text-slate-200"
              >
                <span>Switch Theme</span>
                <span className="font-mono text-cyan-400 uppercase">{theme}</span>
              </button>
            </div>
          </div>
        )}

        {/* Active View Content Area */}
        <main key={activeNav} className="flex-1 flex flex-col overflow-hidden min-w-0 animate-view-enter">
          {activeNav === 'simulator' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Active Lab / Challenge Banner when working on a Guided Lab or Challenge */}
              {(currentProject.labId || currentProject.challengeId) && (
                <div className="px-4 py-2 bg-cyan-950/60 border-b border-cyan-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-cyan-300">
                      {currentProject.labId ? 'Active Guided Lab:' : 'Active Challenge:'}
                    </span>
                    <span className="text-slate-100 font-medium">{currentProject.name}</span>
                  </div>
                  <button
                    onClick={() =>
                      setActiveNav(currentProject.labId ? 'labs' : 'challenges')
                    }
                    className="px-2.5 py-1 rounded bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 whitespace-nowrap"
                  >
                    Check Live Objectives & Instructions
                  </button>
                </div>
              )}

              {/* Upper Split: Left Library + Center Canvas + Right Inspector */}
              <div className="flex-1 flex overflow-hidden min-h-0">
                <TopologyCanvas
                  project={currentProject}
                  selectedDeviceId={selectedDeviceId}
                  onSelectDevice={(id) => setSelectedDeviceId(id)}
                  activeTool={activeTool}
                  onSetTool={setActiveTool}
                  onAddDevice={handleAddDevice}
                  onMoveDevice={handleMoveDevice}
                  onDeleteDevice={handleDeleteDevice}
                  onDuplicateDevice={handleDuplicateDevice}
                  onCreateLink={handleCreateLink}
                  onDeleteLink={handleDeleteLink}
                  onAddAnnotation={(text, x, y) =>
                    commitProjectUpdate({
                      ...currentProject,
                      annotations: [
                        ...currentProject.annotations,
                        { id: `ann-${Date.now()}`, text, x, y, color: 'cyan' },
                      ],
                    })
                  }
                  onUpdateAnnotation={(id, newText) =>
                    commitProjectUpdate({
                      ...currentProject,
                      annotations: currentProject.annotations.map((a) =>
                        a.id === id ? { ...a, text: newText } : a
                      ),
                    })
                  }
                  onDeleteAnnotation={(id) =>
                    commitProjectUpdate({
                      ...currentProject,
                      annotations: currentProject.annotations.filter((a) => a.id !== id),
                    })
                  }
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  canUndo={undoStack.length > 0}
                  canRedo={redoStack.length > 0}
                  snapToGrid={snapToGrid}
                  onToggleSnapToGrid={() => setSnapToGrid((s) => !s)}
                  simulationMode={simulationMode}
                  onSetSimulationMode={setSimulationMode}
                  activeSimulation={activeSimulation}
                  currentStepIndex={currentStepIndex}
                  isPlayingSteps={isPlayingSteps}
                  simulationSpeed={simulationSpeed}
                  onSetSimulationSpeed={setSimulationSpeed}
                  onPlayPauseSteps={() => setIsPlayingSteps((p) => !p)}
                  onNextStep={() =>
                    setCurrentStepIndex((idx) =>
                      Math.min((activeSimulation?.events.length || 1) - 1, idx + 1)
                    )
                  }
                  onResetSteps={() => {
                    setIsPlayingSteps(false);
                    setCurrentStepIndex(0);
                  }}
                  onRunQuickPing={handleRunQuickPing}
                  onRunDiagnostics={handleRunDiagnostics}
                  onOpenCliForDevice={(devId) => {
                    setSelectedDeviceId(devId);
                    setBottomDockOpen(true);
                    setBottomDockTab('cli');
                  }}
                  onOpenDesktopModal={(devId) => setDesktopModalDeviceId(devId)}
                  onOpenMobileInspector={() => setMobileInspectorOpen(true)}
                  onExportPdf={() => handleExportPdf(currentProject)}
                />

                <div className="hidden xl:flex h-full">
                  <DeviceInspector
                    device={selectedDevice}
                    allDevices={currentProject.devices}
                    links={currentProject.links}
                    onUpdateDevice={handleUpdateDevice}
                    onRequestDhcp={handleRequestDhcp}
                    onRunPing={handleRunQuickPing}
                    onOpenCli={(devId) => {
                      setSelectedDeviceId(devId);
                      setBottomDockOpen(true);
                      setBottomDockTab('cli');
                    }}
                    onOpenDesktop={(devId) => setDesktopModalDeviceId(devId)}
                  />
                </div>

                {/* Mobile & Tablet Inspector Drawer */}
                {mobileInspectorOpen && selectedDevice && (
                  <div className="fixed inset-0 z-50 bg-black/70 flex justify-end xl:hidden">
                    <div className="w-full max-w-md bg-slate-900 h-full flex flex-col">
                      <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          Device Inspector — {selectedDevice.name}
                        </span>
                        <button
                          onClick={() => setMobileInspectorOpen(false)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-hidden flex">
                        <DeviceInspector
                          device={selectedDevice}
                          allDevices={currentProject.devices}
                          links={currentProject.links}
                          onUpdateDevice={handleUpdateDevice}
                          onRequestDhcp={handleRequestDhcp}
                          onRunPing={(src, dst) => {
                            setMobileInspectorOpen(false);
                            handleRunQuickPing(src, dst);
                          }}
                          onOpenCli={(devId) => {
                            setMobileInspectorOpen(false);
                            setSelectedDeviceId(devId);
                            setBottomDockOpen(true);
                            setBottomDockTab('cli');
                          }}
                          onOpenDesktop={(devId) => {
                            setMobileInspectorOpen(false);
                            setDesktopModalDeviceId(devId);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible Bottom Workspace Dock (CLI, Packet Inspector, Diagnostics) */}
              <BottomWorkspaceDock
                isOpen={bottomDockOpen}
                onToggleOpen={() => setBottomDockOpen((o) => !o)}
                activeTab={bottomDockTab}
                onSetTab={setBottomDockTab}
                devices={currentProject.devices}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={(id) => setSelectedDeviceId(id)}
                cliSessions={cliSessions}
                onExecuteCliCommand={handleExecuteCliCommand}
                activeSimulation={activeSimulation}
                currentStepIndex={currentStepIndex}
                onSelectStepIndex={(idx) => {
                  setIsPlayingSteps(false);
                  setCurrentStepIndex(idx);
                }}
                diagnosticIssues={diagnosticIssues}
                onRunDiagnostics={handleRunDiagnostics}
              />
            </div>
          )}

          {(activeNav === 'dashboard' ||
            activeNav === 'projects' ||
            activeNav === 'progress' ||
            activeNav === 'settings') && (
            <DashboardAndProjects
              mode={activeNav}
              currentProject={currentProject}
              savedProjects={savedProjects}
              progress={progress}
              theme={theme}
              onSetTheme={setTheme}
              onNavigate={setActiveNav}
              onOpenProject={(proj) => {
                setCurrentProject(proj);
                setSelectedDeviceId(proj.devices[0]?.id || null);
                setUnsavedChanges(false);
              }}
              onCreateNewProject={handleCreateNewProject}
              onSaveCurrentProject={handleSaveCurrentProject}
              onDuplicateProject={(proj) => {
                const dup: NetworkProject = {
                  ...JSON.parse(JSON.stringify(proj)),
                  id: `proj-${Date.now()}`,
                  name: `${proj.name} (Copy)`,
                  updatedAt: new Date().toISOString(),
                };
                const next = [dup, ...savedProjects];
                setSavedProjects(next);
                saveProjectsToStorage(next);
                showToast(`Duplicated "${proj.name}".`);
              }}
              onRenameProject={(id, newName) => {
                const next = savedProjects.map((p) =>
                  p.id === id ? { ...p, name: newName, updatedAt: new Date().toISOString() } : p
                );
                setSavedProjects(next);
                saveProjectsToStorage(next);
                if (currentProject.id === id) {
                  setCurrentProject({ ...currentProject, name: newName });
                }
              }}
              onDeleteProject={(id) => {
                const next = savedProjects.filter((p) => p.id !== id);
                setSavedProjects(next);
                saveProjectsToStorage(next);
                showToast('Project deleted.');
              }}
              onExportProject={handleExportProject}
              onExportProjectPdf={handleExportPdf}
              onImportProjectFile={handleImportProjectFile}
              onStartGuidedLab={(labId) => {
                const lab = GUIDED_LABS.find((l) => l.id === labId);
                if (lab) {
                  const labProj = lab.createInitialProject();
                  setCurrentProject(labProj);
                  setSelectedDeviceId(labProj.devices[0]?.id || null);
                  setActiveNav('simulator');
                  showToast(`Loaded ${lab.title}`);
                }
              }}
              onStartChallenge={(chalId) => {
                const chal = TROUBLESHOOTING_CHALLENGES.find((c) => c.id === chalId);
                if (chal) {
                  const chalProj = chal.buildChallengeProject();
                  setCurrentProject(chalProj);
                  setSelectedDeviceId(chalProj.devices[0]?.id || null);
                  setActiveNav('simulator');
                  showToast(`Loaded ${chal.title}`);
                }
              }}
              onOpenLesson={(lessonId) => {
                setSelectedLessonId(lessonId);
                setActiveNav('learning');
              }}
              onToggleOnboardingDismiss={(dismiss) =>
                setProgress((p) => ({ ...p, onboardingDismissed: dismiss }))
              }
              onResetProgressOnly={() => {
                setProgress({
                  completedLessonIds: [],
                  bookmarkedLessonIds: [],
                  completedLabIds: [],
                  completedChallengeIds: [],
                  cliCommandsExecuted: 0,
                  simulationsRun: 0,
                  subnetsCalculated: 0,
                  onboardingDismissed: false,
                  onboardingChecklist: {
                    addedDevice: false,
                    connectedCable: false,
                    configuredIp: false,
                    usedCli: false,
                    testedPing: false,
                  },
                  recentActivity: [],
                });
                showToast('Learning progress reset (your saved projects were preserved).');
              }}
            />
          )}

          {(activeNav === 'learning' ||
            activeNav === 'labs' ||
            activeNav === 'challenges' ||
            activeNav === 'reference' ||
            activeNav === 'subnet-calc') && (
            <LearningAndToolsViews
              mode={activeNav}
              currentProject={currentProject}
              progress={progress}
              selectedLessonId={selectedLessonId}
              onSelectLesson={setSelectedLessonId}
              onMarkLessonComplete={(id) => {
                setProgress((p) => {
                  if (p.completedLessonIds.includes(id)) return p;
                  return {
                    ...p,
                    completedLessonIds: [...p.completedLessonIds, id],
                    recentActivity: [
                      {
                        id: `act-${Date.now()}`,
                        title: `Completed Lesson: ${id}`,
                        category: 'Learning Center',
                        timestamp: new Date().toISOString(),
                      },
                      ...p.recentActivity.slice(0, 14),
                    ],
                  };
                });
                showToast('Lesson marked as completed!');
              }}
              onToggleBookmarkLesson={(id) => {
                setProgress((p) => ({
                  ...p,
                  bookmarkedLessonIds: p.bookmarkedLessonIds.includes(id)
                    ? p.bookmarkedLessonIds.filter((item) => item !== id)
                    : [...p.bookmarkedLessonIds, id],
                }));
              }}
              onLaunchGuidedLab={(labId) => {
                const lab = GUIDED_LABS.find((l) => l.id === labId);
                if (lab) {
                  const labProj = lab.createInitialProject();
                  setCurrentProject(labProj);
                  setSelectedDeviceId(labProj.devices[0]?.id || null);
                  setActiveNav('simulator');
                  showToast(`Launched ${lab.title} in Simulator`);
                }
              }}
              onMarkLabComplete={(labId) => {
                const lab = GUIDED_LABS.find((l) => l.id === labId);
                setProgress((p) => ({
                  ...p,
                  completedLabIds: Array.from(new Set([...p.completedLabIds, labId])),
                  recentActivity: [
                    {
                      id: `act-${Date.now()}`,
                      title: `Verified Guided Lab: ${lab?.title || labId}`,
                      category: 'Guided Lab',
                      timestamp: new Date().toISOString(),
                    },
                    ...p.recentActivity.slice(0, 14),
                  ],
                }));
                showToast('Guided Lab completion recorded!');
              }}
              onLaunchChallenge={(chalId) => {
                const chal = TROUBLESHOOTING_CHALLENGES.find((c) => c.id === chalId);
                if (chal) {
                  const chalProj = chal.buildChallengeProject();
                  setCurrentProject(chalProj);
                  setSelectedDeviceId(chalProj.devices[0]?.id || null);
                  setActiveNav('simulator');
                  showToast(`Loaded ${chal.title} in Simulator`);
                }
              }}
              onMarkChallengeComplete={(chalId) => {
                const chal = TROUBLESHOOTING_CHALLENGES.find((c) => c.id === chalId);
                setProgress((p) => ({
                  ...p,
                  completedChallengeIds: Array.from(
                    new Set([...p.completedChallengeIds, chalId])
                  ),
                  recentActivity: [
                    {
                      id: `act-${Date.now()}`,
                      title: `Solved Challenge: ${chal?.title || chalId}`,
                      category: 'Troubleshooting',
                      timestamp: new Date().toISOString(),
                    },
                    ...p.recentActivity.slice(0, 14),
                  ],
                }));
                showToast('Challenge solution recorded!');
              }}
              onIncrementSubnetCalc={() =>
                setProgress((p) => ({ ...p, subnetsCalculated: p.subnetsCalculated + 1 }))
              }
            />
          )}
        </main>
      </div>

      {/* Compact Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden h-12 border-t border-slate-800 bg-slate-950 flex items-center justify-around px-2 shrink-0"
      >
        {(
          [
            { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
            { id: 'simulator', label: 'Simulator', icon: Network },
            { id: 'learning', label: 'Learn', icon: BookOpen },
            { id: 'labs', label: 'Labs', icon: FlaskConical },
            { id: 'subnet-calc', label: 'Subnet', icon: Calculator },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 text-[10px] font-medium ${
                activeNav === item.id ? 'text-cyan-400' : 'text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* PC / Laptop / Server Desktop Applications Modal */}
      {desktopModalDevice && (
        <DeviceDesktopModal
          device={desktopModalDevice}
          allDevices={currentProject.devices}
          links={currentProject.links}
          onClose={() => setDesktopModalDeviceId(null)}
          onUpdateDevice={handleUpdateDevice}
          onUpdateMultipleDevices={(updatedDevices) => {
            commitProjectUpdate({
              ...currentProject,
              devices: updatedDevices,
            });
          }}
          onRequestDhcp={handleRequestDhcp}
          onOpenCli={(devId) => {
            setSelectedDeviceId(devId);
            setBottomDockOpen(true);
            setBottomDockTab('cli');
          }}
          onSimulationGenerated={(session, updatedDevices) => {
            commitProjectUpdate({ ...currentProject, devices: updatedDevices }, false);
            setActiveSimulation(session);
            setCurrentStepIndex(Math.max(0, session.events.length - 1));
          }}
        />
      )}

      {/* Non-intrusive Feedback Toast */}
      {saveToast && (
        <div className="fixed bottom-14 md:bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 border border-cyan-500/50 text-xs text-slate-100 shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}
    </div>
  );
}

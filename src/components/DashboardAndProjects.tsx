import React, { useState } from 'react';
import {
  Play,
  BookOpen,
  Calculator,
  Terminal,
  Plus,
  FolderOpen,
  CheckCircle2,
  Circle,
  ArrowRight,
  Layers,
  Award,
  Wrench,
  RotateCcw,
  Trash2,
  Download,
  Upload,
  Copy,
  Edit3,
  X,
  FileDown,
  Cloud,
  CloudCheck,
  LogIn,
  LogOut,
  Loader2,
  Sparkles,
  Check,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { NetworkProject } from '../types/network';
import { NavSection, StudentProgressState } from '../store/persistence';
import { NETWORK_TEMPLATES } from '../data/templates';
import { LEARNING_LESSONS } from '../data/learningContent';
import { GUIDED_LABS, TROUBLESHOOTING_CHALLENGES } from '../data/labsAndChallenges';

interface DashboardAndProjectsProps {
  mode: 'dashboard' | 'projects' | 'progress' | 'settings';
  currentProject: NetworkProject;
  savedProjects: NetworkProject[];
  progress: StudentProgressState;
  theme: 'dark' | 'light';
  onSetTheme: (t: 'dark' | 'light') => void;
  onNavigate: (section: NavSection) => void;
  onOpenProject: (project: NetworkProject) => void;
  onCreateNewProject: (name: string, description: string) => void;
  onSaveCurrentProject: () => void;
  onDuplicateProject: (project: NetworkProject) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  onDeleteProject: (projectId: string) => void;
  onExportProject: (project: NetworkProject) => void;
  onExportProjectPdf?: (project: NetworkProject) => void;
  onImportProjectFile: (file: File) => void;
  onStartGuidedLab: (labId: string) => void;
  onStartChallenge: (challengeId: string) => void;
  onOpenLesson: (lessonId: string) => void;
  onToggleOnboardingDismiss: (dismiss: boolean) => void;
  onResetProgressOnly: () => void;
  // Firebase Auth & Cloud Sync
  authUser?: User | null;
  cloudProjects?: NetworkProject[];
  onSignIn?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
  onSaveToCloud?: (project: NetworkProject) => Promise<void>;
  onDeleteProjectFromCloud?: (projectId: string) => Promise<void>;
  isSavingToCloud?: boolean;
}

export const DashboardAndProjects: React.FC<DashboardAndProjectsProps> = ({
  mode,
  currentProject,
  savedProjects,
  progress,
  theme,
  onSetTheme,
  onNavigate,
  onOpenProject,
  onCreateNewProject,
  onSaveCurrentProject,
  onDuplicateProject,
  onRenameProject,
  onDeleteProject,
  onExportProject,
  onExportProjectPdf,
  onImportProjectFile,
  onStartGuidedLab,
  onStartChallenge,
  onOpenLesson,
  onToggleOnboardingDismiss,
  onResetProgressOnly,
  authUser = null,
  cloudProjects = [],
  onSignIn,
  onSignOut,
  onSaveToCloud,
  onDeleteProjectFromCloud,
  isSavingToCloud = false,
}) => {
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteCloudId, setConfirmDeleteCloudId] = useState<string | null>(null);
  const [confirmResetProgress, setConfirmResetProgress] = useState(false);
  const [dashboardTemplateFilter, setDashboardTemplateFilter] = useState<string>('All');
  const [projectsViewTab, setProjectsViewTab] = useState<'cloud' | 'local'>('cloud');

  const checklistItems = [
    {
      key: 'addedDevice',
      label: 'Add a PC, Switch, or Router to the topology canvas',
      done: progress.onboardingChecklist.addedDevice,
    },
    {
      key: 'connectedCable',
      label: 'Connect two compatible device interfaces with a cable',
      done: progress.onboardingChecklist.connectedCable,
    },
    {
      key: 'configuredIp',
      label: 'Configure an IPv4 address and subnet mask in the Inspector or CLI',
      done: progress.onboardingChecklist.configuredIp,
    },
    {
      key: 'usedCli',
      label: 'Execute a Cisco IOS or PC command in the integrated CLI terminal',
      done: progress.onboardingChecklist.usedCli,
    },
    {
      key: 'testedPing',
      label: 'Run a simulated ICMP Ping and inspect packet encapsulation steps',
      done: progress.onboardingChecklist.testedPing,
    },
  ];

  const completedChecklistCount = checklistItems.filter((i) => i.done).length;
  const nextRecommendedLesson =
    LEARNING_LESSONS.find((l) => !progress.completedLessonIds.includes(l.id)) ||
    LEARNING_LESSONS[0];
  const nextRecommendedLab =
    GUIDED_LABS.find((l) => !progress.completedLabIds.includes(l.id)) || GUIDED_LABS[0];

  // ==========================================================================
  // 1. STUDENT DASHBOARD VIEW
  // ==========================================================================
  if (mode === 'dashboard') {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950 text-slate-100">
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
          {/* Welcome Header & Primary Quick Actions: Fluid across all device screen sizes */}
          <div className="p-4 sm:p-6 rounded-2xl liquid-glass bg-slate-900/60 border border-slate-800/80 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 text-[11px] font-medium tracking-wide">
                <span>CCNA &amp; Computer Systems Servicing</span>
                <span className="text-slate-600">·</span>
                <span className="font-semibold text-cyan-300">Engineered by SHIRO</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight break-words">
                Welcome to NetLab Simulator
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-3xl leading-relaxed break-words">
                Design network topologies, configure Cisco IOS routers and switches via CLI, trace live ARP, ICMP, HTTP, and SMB/FTP packets step-by-step, and master subnetting.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:flex xl:flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
              <button
                onClick={() => onNavigate('simulator')}
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors w-full sm:w-auto shadow-md"
              >
                <Play className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[180px] sm:max-w-[220px]">
                  Continue Workspace ({currentProject.name})
                </span>
              </button>
              <button
                onClick={() => onStartGuidedLab(nextRecommendedLab.id)}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-100 hover:bg-slate-800 transition-colors whitespace-nowrap w-full sm:w-auto"
              >
                Start Guided Lab
              </button>
              <button
                onClick={() => onNavigate('subnet-calc')}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-100 hover:bg-slate-800 transition-colors whitespace-nowrap w-full sm:w-auto"
              >
                <Calculator className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Subnet Calculator
              </button>
              {onExportProjectPdf && (
                <button
                  onClick={() => onExportProjectPdf(currentProject)}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900/90 border border-cyan-500/40 text-cyan-300 hover:bg-slate-800 transition-colors whitespace-nowrap w-full sm:w-auto"
                >
                  <FileDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Export PDF
                </button>
              )}
            </div>
          </div>

          {/* Interactive Onboarding Checklist for New Students */}
          {!progress.onboardingDismissed ? (
            <div className="p-4 sm:p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Getting Started Checklist ({completedChecklistCount}/5 Completed)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Complete these five hands-on steps inside the Network Simulator to experience how topology design, IOS CLI, and packet inspection work together.
                  </p>
                </div>
                <button
                  onClick={() => onToggleOnboardingDismiss(true)}
                  className="text-xs text-slate-400 hover:text-white whitespace-nowrap self-start"
                >
                  Dismiss Checklist
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
                {checklistItems.map((item, idx) => (
                  <div
                    key={item.key}
                    onClick={() => onNavigate('simulator')}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                      item.done
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[11px] text-slate-400">Step 0{idx + 1}</span>
                      {item.done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                    <p className="leading-snug font-medium">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
              <span>New to NetLab Simulator? You can reopen the interactive 5-step onboarding checklist anytime.</span>
              <button
                onClick={() => onToggleOnboardingDismiss(false)}
                className="text-cyan-400 hover:underline font-medium"
              >
                Reopen Checklist
              </button>
            </div>
          )}

          {/* Genuine Student Progress Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 min-w-0">
              <div className="text-xs text-slate-400">Lessons Completed</div>
              <div className="text-2xl font-bold text-white mt-1 tabular-nums">
                {progress.completedLessonIds.length} / {LEARNING_LESSONS.length}
              </div>
              <div className="text-[11px] text-cyan-400 mt-1 truncate">
                Next: {nextRecommendedLesson.title}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
              <div className="text-xs text-slate-400">Guided Labs Passed</div>
              <div className="text-2xl font-bold text-white mt-1 tabular-nums">
                {progress.completedLabIds.length} / {GUIDED_LABS.length}
              </div>
              <div className="text-[11px] text-emerald-400 mt-1">
                Live topology state verified
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
              <div className="text-xs text-slate-400">Troubleshooting Challenges</div>
              <div className="text-2xl font-bold text-white mt-1 tabular-nums">
                {progress.completedChallengeIds.length} / {TROUBLESHOOTING_CHALLENGES.length}
              </div>
              <div className="text-[11px] text-amber-400 mt-1">
                Diagnostic scenarios solved
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
              <div className="text-xs text-slate-400">CLI Commands & Simulations</div>
              <div className="text-2xl font-bold text-white mt-1 tabular-nums">
                {progress.cliCommandsExecuted + progress.simulationsRun}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 tabular-nums">
                {progress.cliCommandsExecuted} CLI cmds · {progress.simulationsRun} packet traces
              </div>
            </div>
          </div>

          {/* Continue Learning & Today's Goal Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recommended Lesson */}
            <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between space-y-4">
              <div>
                <div className="text-xs font-medium text-cyan-400">
                  Continue Learning · {nextRecommendedLesson.pathCategory} · {nextRecommendedLesson.durationMinutes} min
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {nextRecommendedLesson.title}
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {nextRecommendedLesson.explanation[0]}
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-400">
                  Level: {nextRecommendedLesson.level}
                </span>
                <button
                  onClick={() => onOpenLesson(nextRecommendedLesson.id)}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400"
                >
                  Open Lesson <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Recommended Lab */}
            <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between space-y-4">
              <div>
                <div className="text-xs font-medium text-emerald-400">
                  Today&apos;s Hands-On Lab Goal · {nextRecommendedLab.category} · {nextRecommendedLab.estimatedMinutes} min
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {nextRecommendedLab.title}
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {nextRecommendedLab.summary}
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-400">
                  {nextRecommendedLab.objectives.length} live validation checks
                </span>
                <button
                  onClick={() => onStartGuidedLab(nextRecommendedLab.id)}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500"
                >
                  Launch Lab in Simulator <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Ready-to-Open Verified Example Topologies */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Verified Example Topologies &amp; Starter Templates</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-semibold">
                    {NETWORK_TEMPLATES.length} Labs
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Open any pre-built network topology in the simulator without overwriting your saved projects.
                </p>
              </div>
              <button
                onClick={() => onNavigate('projects')}
                className="text-xs text-cyan-400 hover:underline font-medium shrink-0 self-start sm:self-auto"
              >
                Manage All Projects ({savedProjects.length}) →
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 pb-1">
              {(
                ['All', 'Network Topologies', 'Starter LAN', 'Routing', 'VLANs & Switching', 'Services', 'Enterprise', 'Troubleshooting'] as const
              ).map((cat) => {
                const count = cat === 'All'
                  ? NETWORK_TEMPLATES.length
                  : NETWORK_TEMPLATES.filter((t) => t.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setDashboardTemplateFilter(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      dashboardTemplateFilter === cat
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                        : 'bg-slate-900/70 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      dashboardTemplateFilter === cat ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {NETWORK_TEMPLATES.filter(
                (tpl) => dashboardTemplateFilter === 'All' || tpl.category === dashboardTemplateFilter
              ).map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-cyan-500/40 hover:bg-slate-900/80 flex flex-col justify-between space-y-3 transition-all"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-cyan-400 font-medium">
                        {tpl.category}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          tpl.difficulty === 'Beginner'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : tpl.difficulty === 'Intermediate'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {tpl.difficulty}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{tpl.name}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      try {
                        const built = tpl.buildProject();
                        onOpenProject(built);
                        onNavigate('simulator');
                      } catch (err: any) {
                        console.error('Failed to open template topology:', err);
                      }
                    }}
                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 shrink-0" />
                    <span>Open Example Topology</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard Footer Signature */}
          <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <div>
              <span className="font-semibold text-slate-200">NetLab Simulator</span> — Interactive Network Learning &amp; Simulation Platform
            </div>
            <div className="font-mono text-[11px]">
              Designed &amp; Built by <span className="font-bold text-cyan-400">SHIRO</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 2. MY PROJECTS & TEMPLATES VIEW
  // ==========================================================================
  if (mode === 'projects') {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950 text-slate-100">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-white">My Network Projects &amp; Persistence</h1>
              <p className="text-xs text-slate-400 mt-1">
                Create, save, duplicate, export, or import versioned JSON network topologies.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onSaveCurrentProject}
                className="px-3.5 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400"
              >
                Save Active Project ({currentProject.name})
              </button>
              {onExportProjectPdf && (
                <button
                  onClick={() => onExportProjectPdf(currentProject)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  <FileDown className="w-3.5 h-3.5" /> Export Topology to PDF
                </button>
              )}
              <button
                onClick={() => onExportProject(currentProject)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" /> Export JSON
              </button>
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Import JSON
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImportProjectFile(file);
                  }}
                />
              </label>
            </div>
          </div>

          {/* Google Account Cloud Persistence Banner */}
          <div className="p-5 rounded-2xl liquid-glass bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-slate-900/60 border border-indigo-500/30 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0 mt-0.5">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-white">
                      Google Account Cloud Sync
                    </h2>
                    {authUser ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <Check className="w-3 h-3" /> Synced to Account
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        Offline Mode
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    {authUser ? (
                      <span>
                        Signed in as <strong className="text-white">{authUser.displayName || authUser.email}</strong> ({authUser.email}). Your custom topologies and lab designs are safely stored in your Google Cloud account.
                      </span>
                    ) : (
                      'Sign in with your Google account to save your topologies directly to your account, resume your work on any PC or mobile device, and keep your network labs permanently backed up.'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {authUser ? (
                  <>
                    <button
                      onClick={() => onSaveToCloud && onSaveToCloud(currentProject)}
                      disabled={isSavingToCloud}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors disabled:opacity-50"
                    >
                      {isSavingToCloud ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Cloud className="w-3.5 h-3.5" />
                      )}
                      <span>Save Current to Cloud</span>
                    </button>
                    {onSignOut && (
                      <button
                        onClick={onSignOut}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 text-xs transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    )}
                  </>
                ) : (
                  onSignIn && (
                    <button
                      onClick={onSignIn}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold shadow-lg transition-all"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Sign In with Google</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Storage Destination Switcher Tabs */}
          <div className="flex border-b border-slate-800 gap-6">
            <button
              onClick={() => setProjectsViewTab('cloud')}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                projectsViewTab === 'cloud'
                  ? 'border-indigo-400 text-indigo-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cloud className="w-4 h-4 text-indigo-400" />
              <span>Google Cloud Projects</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/20 text-indigo-300">
                {cloudProjects.length}
              </span>
            </button>
            <button
              onClick={() => setProjectsViewTab('local')}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                projectsViewTab === 'local'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOpen className="w-4 h-4 text-cyan-400" />
              <span>Browser Local Storage</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                {savedProjects.length}
              </span>
            </button>
          </div>

          {/* TAB 1: Google Cloud Projects */}
          {projectsViewTab === 'cloud' && (
            <div className="space-y-4">
              {!authUser ? (
                <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/40 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Sign In to View Your Cloud Projects</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Log in with your Google account to access your saved network topologies from any computer or browser.
                  </p>
                  {onSignIn && (
                    <button
                      onClick={onSignIn}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In with Google</span>
                    </button>
                  )}
                </div>
              ) : cloudProjects.length === 0 ? (
                <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/40 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">No Cloud Projects Saved Yet</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    You are connected as <strong>{authUser.email}</strong>. Click below to save your active project directly to your Google account!
                  </p>
                  <button
                    onClick={() => onSaveToCloud && onSaveToCloud(currentProject)}
                    disabled={isSavingToCloud}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
                  >
                    {isSavingToCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                    <span>Save "{currentProject.name}" to Cloud</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cloudProjects.map((proj) => (
                    <div
                      key={proj.id}
                      className="p-4 rounded-xl border border-indigo-500/30 bg-slate-900/60 space-y-3 flex flex-col justify-between hover:border-indigo-400/50 transition-all shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                            <Cloud className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{proj.name}</span>
                          </h3>
                          <span className="text-[11px] font-mono text-indigo-300 tabular-nums">
                            {proj.devices?.length || 0} devices · {proj.links?.length || 0} links
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {proj.description || 'Cloud-synchronized network topology'}
                        </p>
                        <div className="text-[11px] text-slate-500 mt-1 font-mono">
                          Saved: {new Date(proj.updatedAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800">
                        <button
                          onClick={() => {
                            onOpenProject(proj);
                            onNavigate('simulator');
                          }}
                          className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
                        >
                          Open in Simulator
                        </button>
                        <button
                          onClick={() => onExportProject(proj)}
                          className="px-2.5 py-1.5 rounded bg-slate-800 text-slate-300 text-xs hover:text-white"
                        >
                          Export JSON
                        </button>
                        {onExportProjectPdf && (
                          <button
                            onClick={() => onExportProjectPdf(proj)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs hover:bg-cyan-500/25 font-medium"
                          >
                            <FileDown className="w-3 h-3" /> PDF
                          </button>
                        )}
                        {confirmDeleteCloudId === proj.id ? (
                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              onClick={async () => {
                                if (onDeleteProjectFromCloud) {
                                  await onDeleteProjectFromCloud(proj.id);
                                }
                                setConfirmDeleteCloudId(null);
                              }}
                              className="px-2 py-1 rounded bg-rose-600 text-white text-xs font-semibold"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDeleteCloudId(null)}
                              className="px-2 py-1 text-xs text-slate-400"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteCloudId(proj.id)}
                            className="ml-auto p-1.5 text-rose-400 hover:text-rose-300"
                            title="Delete from Cloud"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Browser Local Storage Projects */}
          {projectsViewTab === 'local' && (
            <div className="space-y-6">
              {/* Create New Blank Topology Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newProjName.trim()) return;
                  onCreateNewProject(newProjName.trim(), newProjDesc.trim());
                  setNewProjName('');
                  setNewProjDesc('');
                }}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row gap-3 items-end"
              >
                <div className="flex-1 w-full">
                  <label className="block text-xs text-slate-400 mb-1">New Blank Project Name</label>
                  <input
                    type="text"
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    placeholder="e.g. Branch Office OSPF Lab"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-xs text-slate-400 mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    value={newProjDesc}
                    onChange={(e) => setNewProjDesc(e.target.value)}
                    placeholder="Notes or subnet plan..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold whitespace-nowrap"
                >
                  + Create Blank Network
                </button>
              </form>

              {/* Saved Projects List */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-slate-200">
                  Saved Projects in Browser Storage ({savedProjects.length})
                </h2>
                {savedProjects.length === 0 ? (
                  <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/40 text-center text-xs text-slate-400">
                    You have no local saved projects yet. Click <strong>Save Active Project</strong> above or create a new topology.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {savedProjects.map((proj) => (
                      <div
                        key={proj.id}
                        className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3 flex flex-col justify-between"
                      >
                        <div>
                          {renamingId === proj.id ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={renameText}
                                onChange={(e) => setRenameText(e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                              />
                              <button
                                onClick={() => {
                                  if (renameText.trim()) onRenameProject(proj.id, renameText.trim());
                                  setRenamingId(null);
                                }}
                                className="px-2.5 py-1 rounded bg-cyan-500 text-slate-950 text-xs font-semibold"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-bold text-white">{proj.name}</h3>
                              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                                {proj.devices.length} devices · {proj.links.length} links
                              </span>
                            </div>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            {proj.description || 'Custom network topology'}
                          </p>
                          <div className="text-[11px] text-slate-500 mt-1">
                            Updated: {new Date(proj.updatedAt).toLocaleString()}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800">
                          <button
                            onClick={() => {
                              onOpenProject(proj);
                              onNavigate('simulator');
                            }}
                            className="px-3 py-1.5 rounded bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400"
                          >
                            Open in Simulator
                          </button>
                          <button
                            onClick={() => {
                              setRenamingId(proj.id);
                              setRenameText(proj.name);
                            }}
                            className="px-2.5 py-1.5 rounded bg-slate-800 text-slate-300 text-xs hover:text-white"
                          >
                            Rename
                          </button>
                          <button
                            onClick={() => onDuplicateProject(proj)}
                            className="px-2.5 py-1.5 rounded bg-slate-800 text-slate-300 text-xs hover:text-white"
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => onExportProject(proj)}
                            className="px-2.5 py-1.5 rounded bg-slate-800 text-slate-300 text-xs hover:text-white"
                          >
                            Export JSON
                          </button>
                          {onExportProjectPdf && (
                            <button
                              onClick={() => onExportProjectPdf(proj)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs hover:bg-cyan-500/25 font-medium"
                            >
                              <FileDown className="w-3 h-3" /> PDF
                            </button>
                          )}
                          {confirmDeleteId === proj.id ? (
                            <div className="flex items-center gap-1 ml-auto">
                              <button
                                onClick={() => {
                                  onDeleteProject(proj.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 rounded bg-rose-600 text-white text-xs font-semibold"
                              >
                                Confirm Delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-xs text-slate-400"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(proj.id)}
                              className="ml-auto p-1.5 text-rose-400 hover:text-rose-300"
                              title="Delete Project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 3. LEARNING PROGRESS & MILESTONES VIEW
  // ==========================================================================
  if (mode === 'progress') {
    const milestones = [
      {
        title: 'First Topology Architect',
        desc: 'Add devices and connect cables in the Network Simulator',
        unlocked:
          progress.onboardingChecklist.addedDevice && progress.onboardingChecklist.connectedCable,
      },
      {
        title: 'Cisco IOS Operator',
        desc: 'Execute at least 5 CLI commands on routers, switches, or PCs',
        unlocked: progress.cliCommandsExecuted >= 5,
      },
      {
        title: 'Packet Detective',
        desc: 'Run at least 3 ICMP/DNS/HTTP packet simulations',
        unlocked: progress.simulationsRun >= 3,
      },
      {
        title: 'Guided Lab Graduate',
        desc: 'Complete and validate at least 1 Guided Networking Lab',
        unlocked: progress.completedLabIds.length >= 1,
      },
      {
        title: 'Network Troubleshooter',
        desc: 'Diagnose and solve a broken network challenge',
        unlocked: progress.completedChallengeIds.length >= 1,
      },
    ];

    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950 text-slate-100">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <h1 className="text-2xl font-bold text-white">Learning Progress & Milestones</h1>
              <p className="text-xs text-slate-400 mt-1">
                All statistics and milestones below are calculated directly from your real lab validations, completed lessons, and CLI practice.
              </p>
            </div>
            {confirmResetProgress ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onResetProgressOnly();
                    setConfirmResetProgress(false);
                  }}
                  className="px-3 py-1.5 rounded bg-rose-600 text-white text-xs font-semibold"
                >
                  Confirm Reset Learning Progress
                </button>
                <button
                  onClick={() => setConfirmResetProgress(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmResetProgress(true)}
                className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white"
              >
                Reset Progress (Keep Saved Projects)
              </button>
            )}
          </div>

          {/* Earned Milestones */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-200">Skill Milestones</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {milestones.map((m) => (
                <div
                  key={m.title}
                  className={`p-4 rounded-xl border ${
                    m.unlocked
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                      : 'bg-slate-900/40 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold">{m.title}</span>
                    <span className="text-[11px] font-mono">
                      {m.unlocked ? 'EARNED' : 'LOCKED'}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity Log */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-200">Recent Learning & Lab Activity</h2>
            {progress.recentActivity.length === 0 ? (
              <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 text-xs text-slate-400">
                No completed lessons or lab validations recorded yet. Start a lesson or guided lab to log your progress!
              </div>
            ) : (
              <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/50">
                {progress.recentActivity.map((act) => (
                  <div key={act.id} className="px-4 py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-100">{act.title}</span>
                      <span className="text-slate-500 mx-2">·</span>
                      <span className="text-cyan-400">{act.category}</span>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px] tabular-nums">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 4. SETTINGS & SIMULATOR DOCUMENTATION VIEW
  // ==========================================================================
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-bold text-white">Workstation Settings & Simulation Notes</h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure appearance preferences and review supported protocol simulation fidelity.
          </p>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white">Interface Theme Mode</div>
              <p className="text-slate-400 mt-0.5">
                Switch between Dark Graphite Workstation (default) and High-Contrast Light mode.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onSetTheme('dark')}
                className={`px-3 py-1.5 rounded-lg font-medium ${
                  theme === 'dark'
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                Dark Graphite
              </button>
              <button
                onClick={() => onSetTheme('light')}
                className={`px-3 py-1.5 rounded-lg font-medium ${
                  theme === 'light'
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                Light Mode
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-white">
            Simulation Architecture &amp; Scope Transparency
          </h2>
          <p className="text-slate-300 leading-relaxed">
            NetLab Simulator executes an authoritative discrete-event packet engine in your browser. It models Layer 2 Ethernet switching, dynamic MAC learning, IEEE 802.1Q VLAN tagging and trunk pruning, ARP broadcast/reply resolution, IPv4 subnetting, Longest-Prefix Match routing (Connected, Static, OSPF, RIPv2), Inbound/Outbound ACL filtering, NAT translation, DHCP DORA leasing, DNS A-record resolution, HTTP web servers, and real-time SMB/FTP File Sharing.
          </p>
          <p className="text-slate-400 leading-relaxed">
            <strong>Documented Simulation Boundaries:</strong> This educational engine does not emulate physical RF radio interference, electrical cable attenuation, full Linux/IOS kernel binaries, BGP/MPLS traffic engineering, or hardware ASIC timing.
          </p>
        </div>

        <div className="p-5 rounded-xl border border-cyan-500/30 bg-slate-900/80 flex items-center justify-between gap-4 text-xs">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
              Platform Creator &amp; Lead Architect
            </div>
            <div className="text-base font-bold text-white mt-0.5">
              Made by SHIRO
            </div>
            <p className="text-slate-400 mt-1">
              Built for Computer Networking, Computer Systems Servicing (CSS), CCNA fundamentals, and Information Technology students.
            </p>
          </div>
          <div className="px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs font-bold text-cyan-400 shrink-0">
            SHIRO EDITION
          </div>
        </div>
      </div>
    </div>
  );
};

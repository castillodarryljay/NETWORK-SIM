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
} from 'lucide-react';
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
}) => {
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmResetProgress, setConfirmResetProgress] = useState(false);

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
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Welcome Header & Primary Quick Actions */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <p className="text-xs font-medium text-cyan-400 tracking-wide">
                CCNA &amp; Computer Systems Servicing Workstation · Engineered by SHIRO
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 tracking-tight">
                Welcome to NetLab Simulator
              </h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Design network topologies, configure Cisco IOS routers and switches via CLI, trace live ARP, ICMP, HTTP, and SMB/FTP packets step-by-step, and master subnetting.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => onNavigate('simulator')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" /> Continue Workspace ({currentProject.name})
              </button>
              <button
                onClick={() => onStartGuidedLab(nextRecommendedLab.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 border border-slate-700 text-slate-100 hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Start Guided Lab
              </button>
              <button
                onClick={() => onNavigate('subnet-calc')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 border border-slate-700 text-slate-100 hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                <Calculator className="w-3.5 h-3.5 text-cyan-400" /> Subnet Calculator
              </button>
              {onExportProjectPdf && (
                <button
                  onClick={() => onExportProjectPdf(currentProject)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 border border-cyan-500/40 text-cyan-300 hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <FileDown className="w-3.5 h-3.5 text-cyan-400" /> Export Topology to PDF
                </button>
              )}
            </div>
          </div>

          {/* Interactive Onboarding Checklist for New Students */}
          {!progress.onboardingDismissed ? (
            <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
              <div className="flex items-start justify-between gap-4">
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
                  className="text-xs text-slate-400 hover:text-white whitespace-nowrap"
                >
                  Dismiss Checklist
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
              <div className="text-xs text-slate-400">Lessons Completed</div>
              <div className="text-2xl font-bold text-white mt-1 tabular-nums">
                {progress.completedLessonIds.length} / {LEARNING_LESSONS.length}
              </div>
              <div className="text-[11px] text-cyan-400 mt-1">
                Next: {nextRecommendedLesson.title.slice(0, 28)}...
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">
                  Verified Example Topologies & Starter Templates
                </h2>
                <p className="text-xs text-slate-400">
                  Open any pre-built network topology in the simulator without overwriting your saved projects.
                </p>
              </div>
              <button
                onClick={() => onNavigate('projects')}
                className="text-xs text-cyan-400 hover:underline font-medium"
              >
                Manage All Projects ({savedProjects.length})
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {NETWORK_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="text-[11px] text-cyan-400 font-medium">
                      {tpl.category} · {tpl.difficulty}
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1">{tpl.name}</h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const built = tpl.buildProject();
                      onOpenProject(built);
                      onNavigate('simulator');
                    }}
                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    Open Example Topology
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <h1 className="text-2xl font-bold text-white">My Network Projects & Persistence</h1>
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
                You have no saved projects yet. Click <strong>Save Active Project</strong> above or create a new topology.
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

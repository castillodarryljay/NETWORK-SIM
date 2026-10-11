import React from 'react';
import {
  CliSessionState,
  DiagnosticIssue,
  NetworkDevice,
  NetworkLink,
  NetworkProject,
  SimulationSession,
} from '../types/network';
import { NETWORK_TEMPLATES } from '../data/templates';
import { synchronizeNetworkState } from '../engine/simulationEngine';

export type NavSection =
  | 'dashboard'
  | 'simulator'
  | 'learning'
  | 'labs'
  | 'challenges'
  | 'projects'
  | 'reference'
  | 'subnet-calc'
  | 'progress'
  | 'settings';

export type CanvasTool = 'select' | 'connect' | 'inspect' | 'annotate' | 'delete';

export interface StudentProgressState {
  completedLessonIds: string[];
  bookmarkedLessonIds: string[];
  completedLabIds: string[];
  completedChallengeIds: string[];
  cliCommandsExecuted: number;
  simulationsRun: number;
  subnetsCalculated: number;
  onboardingDismissed: boolean;
  onboardingChecklist: {
    addedDevice: boolean;
    connectedCable: boolean;
    configuredIp: boolean;
    usedCli: boolean;
    testedPing: boolean;
  };
  recentActivity: { id: string; title: string; category: string; timestamp: string }[];
}

const STORAGE_KEYS = {
  CURRENT_PROJECT: 'netlab_current_project_v1',
  SAVED_PROJECTS: 'netlab_saved_projects_v1',
  PROGRESS: 'netlab_student_progress_v1',
  THEME: 'netlab_theme_v1',
};

const DEFAULT_PROGRESS: StudentProgressState = {
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
};

export function validateAndMigrateProjectJson(raw: unknown): {
  valid: boolean;
  project?: NetworkProject;
  error?: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Project file must be a valid JSON object.' };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.name !== 'string' || obj.name.length > 120) {
    return { valid: false, error: 'Invalid or missing project name (max 120 chars).' };
  }
  if (!Array.isArray(obj.devices) || obj.devices.length > 100) {
    return { valid: false, error: 'Invalid devices array (max 100 devices supported per topology).' };
  }
  if (!Array.isArray(obj.links) || obj.links.length > 250) {
    return { valid: false, error: 'Invalid links array.' };
  }

  try {
    const synced = synchronizeNetworkState(
      obj.devices as NetworkDevice[],
      obj.links as NetworkLink[]
    );
    const project: NetworkProject = {
      id: typeof obj.id === 'string' ? obj.id : `proj-${Date.now()}`,
      version: '1.0.0',
      name: obj.name.trim() || 'Imported Topology',
      description: typeof obj.description === 'string' ? obj.description.slice(0, 500) : '',
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      devices: synced.devices,
      links: synced.links,
      annotations: Array.isArray(obj.annotations) ? obj.annotations : [],
      labId: typeof obj.labId === 'string' ? obj.labId : undefined,
      challengeId: typeof obj.challengeId === 'string' ? obj.challengeId : undefined,
    };
    return { valid: true, project };
  } catch (e) {
    return { valid: false, error: 'Failed to parse device or interface definitions in project JSON.' };
  }
}

export function loadInitialProject(): NetworkProject {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT);
    if (saved) {
      const parsed = JSON.parse(saved);
      const validated = validateAndMigrateProjectJson(parsed);
      if (validated.valid && validated.project) {
        return validated.project;
      }
    }
  } catch {
    // Fallback to default verified template
  }
  return NETWORK_TEMPLATES[0].buildProject();
}

export function loadSavedProjects(): NetworkProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_PROJECTS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr
          .map((item) => validateAndMigrateProjectJson(item))
          .filter((r) => r.valid && r.project)
          .map((r) => r.project!);
      }
    }
  } catch {
    // ignore storage errors
  }
  return [NETWORK_TEMPLATES[0].buildProject(), NETWORK_TEMPLATES[1].buildProject()];
}

export function saveProjectsToStorage(projects: NetworkProject[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_PROJECTS, JSON.stringify(projects));
    return true;
  } catch {
    return false;
  }
}

export function autosaveCurrentProject(project: NetworkProject): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}

export function loadStudentProgress(): StudentProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PROGRESS,
        ...parsed,
        onboardingChecklist: {
          ...DEFAULT_PROGRESS.onboardingChecklist,
          ...(parsed.onboardingChecklist || {}),
        },
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_PROGRESS;
}

export function saveStudentProgress(progress: StudentProgressState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

export function loadThemePreference(): 'dark' | 'light' {
  try {
    const t = localStorage.getItem(STORAGE_KEYS.THEME);
    return t === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveThemePreference(theme: 'dark' | 'light'): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch {
    // ignore
  }
}

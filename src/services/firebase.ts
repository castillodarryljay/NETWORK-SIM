import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  getDocFromServer,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { NetworkProject } from '../types/network';

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Initialize Firestore with the provisioned database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Verify connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore connection: client is offline.');
      return false;
    }
    // Permissions error or non-existent document is normal for test doc
    return true;
  }
}

// Google Auth Handlers
export async function signInWithGoogle(): Promise<User> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    // Sync profile to /users/{uid}
    if (cred.user) {
      const userRef = doc(db, 'users', cred.user.uid);
      await setDoc(
        userRef,
        {
          id: cred.user.uid,
          email: cred.user.email || '',
          displayName: cred.user.displayName || 'Network Engineer',
          photoURL: cred.user.photoURL || '',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch((err) => {
        console.warn('User profile sync warning:', err);
      });
    }
    return cred.user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

export async function signOutFromApp(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// Cloud Project Persistence Handlers
export async function saveProjectToCloud(
  userId: string,
  project: NetworkProject
): Promise<{ ok: boolean; error?: string }> {
  const path = `users/${userId}/projects/${project.id}`;
  try {
    const projectRef = doc(db, 'users', userId, 'projects', project.id);
    const payload = {
      id: project.id,
      userId,
      name: project.name || 'Untitled Topology',
      description: project.description || '',
      projectJson: JSON.stringify(project),
      deviceCount: project.devices?.length || 0,
      linkCount: project.links?.length || 0,
      updatedAt: new Date().toISOString(),
      createdAt: project.createdAt || new Date().toISOString(),
    };
    await setDoc(projectRef, payload, { merge: true });
    return { ok: true };
  } catch (err) {
    console.error('Failed to save project to cloud:', err);
    try {
      handleFirestoreError(err, OperationType.WRITE, path);
    } catch {
      // Return structured response
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function fetchUserCloudProjects(userId: string): Promise<NetworkProject[]> {
  const path = `users/${userId}/projects`;
  try {
    const colRef = collection(db, 'users', userId, 'projects');
    const snap = await getDocs(colRef);
    const list: NetworkProject[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.projectJson) {
        try {
          const parsed = JSON.parse(data.projectJson);
          list.push(parsed);
        } catch (e) {
          console.warn('Skipping unparsable project:', data.id);
        }
      }
    });
    return list;
  } catch (err) {
    console.error('Failed to fetch cloud projects:', err);
    return [];
  }
}

export function subscribeToCloudProjects(
  userId: string,
  onUpdate: (projects: NetworkProject[]) => void
): () => void {
  const path = `users/${userId}/projects`;
  const colRef = collection(db, 'users', userId, 'projects');
  return onSnapshot(
    colRef,
    (snap) => {
      const list: NetworkProject[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.projectJson) {
          try {
            const parsed = JSON.parse(data.projectJson);
            list.push(parsed);
          } catch {
            // ignore
          }
        }
      });
      onUpdate(list);
    },
    (err) => {
      console.error('Realtime cloud projects subscription error:', err);
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function deleteProjectFromCloud(
  userId: string,
  projectId: string
): Promise<{ ok: boolean; error?: string }> {
  const path = `users/${userId}/projects/${projectId}`;
  try {
    const projectRef = doc(db, 'users', userId, 'projects', projectId);
    await deleteDoc(projectRef);
    return { ok: true };
  } catch (err) {
    console.error('Failed to delete cloud project:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

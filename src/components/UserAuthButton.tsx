import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Cloud, CloudCheck, LogIn, LogOut, User as UserIcon, Loader2, Sparkles } from 'lucide-react';

interface UserAuthButtonProps {
  user: User | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSaveToCloud?: () => Promise<void>;
  onOpenProjects?: () => void;
  isSavingToCloud?: boolean;
}

export const UserAuthButton: React.FC<UserAuthButtonProps> = ({
  user,
  onSignIn,
  onSignOut,
  onSaveToCloud,
  onOpenProjects,
  isSavingToCloud = false,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignInClick = async () => {
    try {
      setIsSigningIn(true);
      await onSignIn();
    } finally {
      setIsSigningIn(false);
    }
  };

  if (!user) {
    return (
      <button
        onClick={handleSignInClick}
        disabled={isSigningIn}
        title="Sign in with your Google account to save topologies to the cloud"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg liquid-glass bg-slate-900/90 border border-slate-700/80 hover:border-cyan-500/50 text-slate-100 hover:text-white text-xs font-medium transition-all shadow-md group disabled:opacity-50 shrink-0"
      >
        {isSigningIn ? (
          <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
        ) : (
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
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
        )}
        <span className="hidden sm:inline">Sign In with Google</span>
        <span className="sm:hidden">Sign In</span>
      </button>
    );
  }

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        onClick={() => setDropdownOpen((v) => !v)}
        className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-lg liquid-glass bg-slate-900/90 border border-slate-700/80 hover:border-cyan-500/50 text-slate-200 transition-all shadow-md"
        title={`Logged in as ${user.displayName || user.email}`}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'Avatar'}
            className="w-5 h-5 rounded-full object-cover border border-cyan-500/40 shrink-0"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-[10px] shrink-0 border border-cyan-500/40">
            {user.email?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
        <span className="hidden md:inline text-xs font-semibold text-slate-100 max-w-[110px] truncate">
          {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
        </span>
        <span className="relative flex h-2 w-2 mr-0.5">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
        </span>
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl liquid-glass-elevated bg-slate-900/95 border border-slate-700 shadow-2xl p-3 z-50 animate-view-fade-slide">
          {/* User info banner */}
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="Avatar"
                className="w-9 h-9 rounded-full object-cover border border-cyan-500/40"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs border border-cyan-500/40">
                {user.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">
                {user.displayName || 'Network Engineer'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span className="text-[10px] text-emerald-400 font-medium">Google Account Linked</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="py-2.5 space-y-1.5 border-b border-slate-800">
            {onSaveToCloud && (
              <button
                onClick={async () => {
                  await onSaveToCloud();
                  setDropdownOpen(false);
                }}
                disabled={isSavingToCloud}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition-colors text-xs font-semibold disabled:opacity-50"
              >
                {isSavingToCloud ? (
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                ) : (
                  <Cloud className="w-4 h-4 text-cyan-400 shrink-0" />
                )}
                <span>Save Current Project to Cloud</span>
              </button>
            )}

            {onOpenProjects && (
              <button
                onClick={() => {
                  onOpenProjects();
                  setDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-xs font-medium"
              >
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>View Saved Cloud Projects</span>
              </button>
            )}
          </div>

          {/* Sign Out */}
          <div className="pt-2">
            <button
              onClick={async () => {
                await onSignOut();
                setDropdownOpen(false);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors font-medium"
            >
              <span>Sign Out</span>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

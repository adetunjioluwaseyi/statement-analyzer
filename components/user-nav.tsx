'use client';

import React from 'react';
import { useAuth } from '@/context/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Shield, LogOut, History, UserCheck, AlertTriangle, LogIn } from 'lucide-react';
import { toast } from 'sonner';

interface UserNavProps {
  onOpenAdmin?: () => void;
  onOpenHistory?: () => void;
  onOpenAuth?: () => void;
}

export function UserNav({ onOpenAdmin, onOpenHistory, onOpenAuth }: UserNavProps) {
  const { user, profile, loading, isAdmin, isSuspended, loginWithGoogle, logoutUser } = useAuth();

  const handleSignIn = async () => {
    try {
      await loginWithGoogle();
      toast.success('Signed in successfully with Google');
    } catch (err: unknown) {
      console.error(err);
      toast.error('Could not complete Google sign-in. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
      toast.info('Signed out of your account');
    } catch {
      toast.error('Failed to sign out');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-24 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  if (!user) {
    return (
      <Button
        id="google-signin-header-btn"
        variant="outline"
        size="sm"
        onClick={handleSignIn}
        className="gap-2 font-medium text-xs border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
        Sign in with Google
      </Button>
    );
  }

  const initials = (profile?.displayName || user.displayName || user.email || 'U')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-2.5">
      {isAdmin && (
        <Button
          id="admin-console-quick-btn"
          size="sm"
          variant="secondary"
          onClick={onOpenAdmin}
          className="h-8 gap-1.5 text-xs font-semibold bg-amber-500/15 text-amber-900 hover:bg-amber-500/25 border border-amber-500/30"
        >
          <Shield className="w-3.5 h-3.5 text-amber-600" />
          <span>Admin Console</span>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            id="user-profile-menu-trigger"
            className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-primary/20 focus:outline-none transition-all"
          >
            <Avatar className="h-8 w-8 border border-border shadow-xs">
              <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} />
              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 p-2" align="end">
          <DropdownMenuLabel className="font-normal px-2 py-1.5">
            <div className="flex flex-col space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate leading-none">
                  {profile?.displayName || user.displayName || 'Account'}
                </p>
                {isAdmin && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 border-amber-300 font-medium">
                    Admin
                  </Badge>
                )}
                {isSuspended && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-medium">
                    Suspended
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {isSuspended && (
            <div className="m-1.5 p-2 bg-red-50 border border-red-200 rounded-md text-[11px] text-red-800 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
              <span>Your account is currently suspended. Upload permissions are restricted.</span>
            </div>
          )}

          <DropdownMenuGroup>
            {isAdmin && (
              <DropdownMenuItem
                id="menu-open-admin-console"
                onClick={onOpenAdmin}
                className="gap-2 cursor-pointer font-medium text-amber-900 focus:bg-amber-50"
              >
                <Shield className="w-4 h-4 text-amber-600" />
                <span>Admin Console</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              id="menu-open-my-uploads"
              onClick={onOpenHistory}
              className="gap-2 cursor-pointer"
            >
              <History className="w-4 h-4 text-muted-foreground" />
              <span>Statement History</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            id="menu-logout-btn"
            onClick={handleSignOut}
            className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

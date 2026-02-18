import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface TermsVersion {
  version: string;
  change_description: string;
  created_at: string;
}

interface TermsData {
  latestVersion: string;
  userAcceptedVersion: string | null;
  pendingVersions: { version: string; changeDescription: string }[];
  needsConfirmation: boolean;
}

export interface UseTermsConfirmationResult {
  loading: boolean;
  needsConfirmation: boolean;
  latestVersion: string;
  pendingVersions: { version: string; changeDescription: string }[];
  acceptTerms: () => Promise<void>;
}

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.').map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseVersion(a);
  const [bMajor, bMinor, bPatch] = parseVersion(b);
  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

function requiresReconfirmation(userVersion: string | null, latestVersion: string): boolean {
  if (!userVersion) return true;
  const [userMajor, userMinor] = parseVersion(userVersion);
  const [latestMajor, latestMinor] = parseVersion(latestVersion);
  if (latestMajor > userMajor) return true;
  if (latestMajor === userMajor && latestMinor > userMinor) return true;
  return false;
}

function isMajorOrMinorRelease(version: string): boolean {
  const [, , patch] = parseVersion(version);
  return patch === 0;
}

async function fetchTermsData(userId: string): Promise<TermsData> {
  const [versionsResult, profileResult] = await Promise.all([
    supabase
      .from('bathos_terms_versions')
      .select('version, change_description, created_at')
      .order('created_at', { ascending: true }),
    supabase
      .from('bathos_profiles')
      .select('terms_version_accepted')
      .eq('id', userId)
      .single()
  ]);

  if (versionsResult.error) throw versionsResult.error;
  if (profileResult.error) throw profileResult.error;

  const allVersions = versionsResult.data as TermsVersion[];
  const userVersion = profileResult.data?.terms_version_accepted || null;

  const sortedVersions = [...allVersions].sort((a, b) => compareVersions(b.version, a.version));
  const latest = sortedVersions[0]?.version || '';

  const needsReconfirm = requiresReconfirmation(userVersion, latest);

  let pendingVersions: { version: string; changeDescription: string }[] = [];
  if (needsReconfirm) {
    pendingVersions = allVersions
      .filter(v => requiresReconfirmation(userVersion, v.version))
      .filter(v => isMajorOrMinorRelease(v.version))
      .sort((a, b) => compareVersions(a.version, b.version))
      .map(v => ({ version: v.version, changeDescription: v.change_description }));
  }

  return {
    latestVersion: latest,
    userAcceptedVersion: userVersion,
    pendingVersions,
    needsConfirmation: needsReconfirm,
  };
}

export function useTermsConfirmation(): UseTermsConfirmationResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['terms-confirmation', user?.id];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchTermsData(user!.id),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!user || !data?.latestVersion) throw new Error('Cannot accept terms');
      const { error } = await supabase
        .from('bathos_profiles')
        .update({ terms_version_accepted: data.latestVersion })
        .eq('id', user.id);
      if (error) throw error;
      return data.latestVersion;
    },
    onSuccess: (newVersion) => {
      queryClient.setQueryData<TermsData>(queryKey, (old) => {
        if (!old) return old;
        return { ...old, userAcceptedVersion: newVersion, needsConfirmation: false, pendingVersions: [] };
      });
    },
  });

  const acceptTerms = useCallback(async () => {
    await acceptMutation.mutateAsync();
  }, [acceptMutation]);

  const needsConfirmation = isError ? false : (data?.needsConfirmation ?? false);

  return {
    loading: isLoading,
    needsConfirmation,
    latestVersion: data?.latestVersion ?? '',
    pendingVersions: data?.pendingVersions ?? [],
    acceptTerms,
  };
}

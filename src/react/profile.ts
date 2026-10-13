import type { ElevationProvider, Profile } from '../core/index.js';
import { useElevation, type ElevationStatus } from './elevation.js';

export type ProfileStatus = ElevationStatus;

export interface UseProfileOptions {
    step?: number;
    maxSamples?: number;
    debounce?: number;
}

export interface ProfileResult {
    status: ProfileStatus;
    profile: Profile | null;
    error: unknown;
    refresh(): void;
}

const profileOnly = ['profile'] as const;

export function useProfile(
    id: string | null,
    provider: ElevationProvider | null,
    options: UseProfileOptions = {},
): ProfileResult {
    const { status, elevation, error, refresh } = useElevation(id, provider, { ...options, kinds: profileOnly });
    return { status, profile: elevation?.kind === 'profile' ? elevation.profile : null, error, refresh };
}

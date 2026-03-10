import { useCallback, useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export function useExerciseAlert() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const warnedRef = useRef(false);

  const warn = useCallback(() => {
    if (warnedRef.current) return;
    warnedRef.current = true;
    toast({
      title: 'Timer Alert May Be Muted',
      description: 'This browser blocked audio playback for timer alerts.',
      variant: 'destructive',
    });
  }, []);

  const ensureAudioContext = useCallback(async () => {
    const ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!ctor) {
      warn();
      return null;
    }

    try {
      const context = audioContextRef.current ?? new ctor();
      audioContextRef.current = context;

      if (context.state === 'suspended') {
        await context.resume();
      }

      return context;
    } catch {
      warn();
      return null;
    }
  }, [warn]);

  const primeAlert = useCallback(async () => {
    const context = await ensureAudioContext();
    return context != null;
  }, [ensureAudioContext]);

  const playAlert = useCallback(async () => {
    const context = await ensureAudioContext();
    if (!context) return false;

    const startAt = context.currentTime;
    for (const offset of [0, 0.22]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, startAt + offset);
      gain.gain.exponentialRampToValueAtTime(0.15, startAt + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.16);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt + offset);
      oscillator.stop(startAt + offset + 0.18);
    }

    return true;
  }, [ensureAudioContext]);

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, []);

  return {
    playAlert,
    primeAlert,
  };
}

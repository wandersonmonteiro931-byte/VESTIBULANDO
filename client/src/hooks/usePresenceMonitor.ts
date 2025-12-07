import { useState, useEffect, useCallback, useRef } from "react";

export interface PresenceState {
  isActive: boolean;
  isTabVisible: boolean;
  lastActivityTime: number;
  inactivityDuration: number;
  absenceDuration: number;
  totalAbsenceTime: number;
  isShowingConfirmation: boolean;
  confirmationCountdown: number;
  absenceWarningShown: boolean;
  showReturnModal: boolean;
  lastAbsenceDuration: number;
}

export interface PresenceMonitorConfig {
  inactivityTimeout: number;
  confirmationTimeout: number;
  maxAbsenceTime: number;
  onInactivityDetected: () => void;
  onAbsenceDetected: () => void;
  onAbsenceReturn: () => void;
  onConfirmationRequired: () => void;
  onConfirmationTimeout: () => void;
  onMaxAbsenceReached: () => void;
  enabled: boolean;
}

const DEFAULT_CONFIG: PresenceMonitorConfig = {
  inactivityTimeout: 180,
  confirmationTimeout: 120,
  maxAbsenceTime: 300,
  onInactivityDetected: () => {},
  onAbsenceDetected: () => {},
  onAbsenceReturn: () => {},
  onConfirmationRequired: () => {},
  onConfirmationTimeout: () => {},
  onMaxAbsenceReached: () => {},
  enabled: true,
};

export function usePresenceMonitor(config: Partial<PresenceMonitorConfig> = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState<PresenceState>({
    isActive: true,
    isTabVisible: true,
    lastActivityTime: Date.now(),
    inactivityDuration: 0,
    absenceDuration: 0,
    totalAbsenceTime: 0,
    isShowingConfirmation: false,
    confirmationCountdown: mergedConfig.confirmationTimeout,
    absenceWarningShown: false,
    showReturnModal: false,
    lastAbsenceDuration: 0,
  });

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const absenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const confirmationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const absenceSoundIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const absenceStartRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const alarmPatternRef = useRef<NodeJS.Timeout | null>(null);

  const playAlertSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.log("Could not play alert sound");
    }
  }, []);

  const startContinuousAlarm = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
        } catch (e) {}
      }

      // Triple beep pattern that repeats
      const playTripleBeep = () => {
        const beepDuration = 0.15;
        const pauseDuration = 0.1;
        const frequencies = [1200, 1400, 1600]; // Ascending tones
        
        frequencies.forEach((freq, index) => {
          const startTime = ctx.currentTime + (index * (beepDuration + pauseDuration));
          
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.type = 'sawtooth';
          osc.frequency.value = freq;
          gain.gain.value = 0.35;
          
          // Fade out effect
          gain.gain.setValueAtTime(0.35, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + beepDuration);
          
          osc.start(startTime);
          osc.stop(startTime + beepDuration);
        });
      };

      // Play immediately
      playTripleBeep();
      
      // Repeat every 1.2 seconds
      alarmPatternRef.current = setInterval(() => {
        playTripleBeep();
      }, 1200);
      
    } catch (e) {
      console.log("Could not start continuous alarm");
    }
  }, []);

  const stopContinuousAlarm = useCallback(() => {
    try {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
    } catch (e) {}
    
    if (alarmPatternRef.current) {
      clearInterval(alarmPatternRef.current);
      alarmPatternRef.current = null;
    }
  }, []);

  const resetActivity = useCallback(() => {
    setState(prev => ({
      ...prev,
      lastActivityTime: Date.now(),
      inactivityDuration: 0,
      isActive: true,
    }));
  }, []);

  const confirmPresence = useCallback(() => {
    if (confirmationTimerRef.current) {
      clearInterval(confirmationTimerRef.current);
      confirmationTimerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isShowingConfirmation: false,
      confirmationCountdown: mergedConfig.confirmationTimeout,
      inactivityDuration: 0,
      lastActivityTime: Date.now(),
      isActive: true,
    }));
  }, [mergedConfig.confirmationTimeout]);

  const startIntermittentSound = useCallback(() => {
    startContinuousAlarm();
  }, [startContinuousAlarm]);

  const stopIntermittentSound = useCallback(() => {
    stopContinuousAlarm();
    if (absenceSoundIntervalRef.current) {
      clearInterval(absenceSoundIntervalRef.current);
      absenceSoundIntervalRef.current = null;
    }
  }, [stopContinuousAlarm]);

  const dismissReturnModal = useCallback(() => {
    setState(prev => ({ ...prev, showReturnModal: false }));
  }, []);

  const handleVisibilityChange = useCallback(() => {
    const isVisible = document.visibilityState === "visible";
    console.log("[usePresenceMonitor] visibilitychange - isVisible:", isVisible, "enabled:", mergedConfig.enabled);
    
    if (!isVisible && mergedConfig.enabled) {
      console.log("[usePresenceMonitor] Tab hidden - starting continuous alarm");
      absenceStartRef.current = Date.now();
      startIntermittentSound();
      mergedConfig.onAbsenceDetected();
      setState(prev => ({
        ...prev,
        isTabVisible: false,
        absenceWarningShown: true,
      }));
    } else if (isVisible && absenceStartRef.current) {
      const absenceDuration = Math.floor((Date.now() - absenceStartRef.current) / 1000);
      console.log("[usePresenceMonitor] Tab visible - absence duration:", absenceDuration, "seconds");
      absenceStartRef.current = null;
      stopIntermittentSound();
      
      setState(prev => ({
        ...prev,
        isTabVisible: true,
        absenceDuration: 0,
        totalAbsenceTime: prev.totalAbsenceTime + absenceDuration,
        absenceWarningShown: false,
        showReturnModal: absenceDuration >= 3,
        lastAbsenceDuration: absenceDuration,
      }));
      
      mergedConfig.onAbsenceReturn();
    }
  }, [mergedConfig, startIntermittentSound, stopIntermittentSound]);

  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (mergedConfig.enabled) {
      e.preventDefault();
      e.returnValue = "Você está em uma aula ao vivo. Se sair, será marcado como falta.";
      return e.returnValue;
    }
  }, [mergedConfig.enabled]);

  useEffect(() => {
    if (!mergedConfig.enabled) return;

    const activityEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    
    const handleActivity = () => {
      resetActivity();
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      stopIntermittentSound();
    };
  }, [mergedConfig.enabled, resetActivity, handleVisibilityChange, handleBeforeUnload, stopIntermittentSound]);

  useEffect(() => {
    if (!mergedConfig.enabled) return;

    inactivityTimerRef.current = setInterval(() => {
      setState(prev => {
        if (!prev.isTabVisible || prev.isShowingConfirmation) return prev;

        const inactivityDuration = Math.floor((Date.now() - prev.lastActivityTime) / 1000);
        
        if (inactivityDuration >= mergedConfig.inactivityTimeout && !prev.isShowingConfirmation) {
          mergedConfig.onInactivityDetected();
          mergedConfig.onConfirmationRequired();
          playAlertSound();
          return {
            ...prev,
            inactivityDuration,
            isActive: false,
            isShowingConfirmation: true,
          };
        }

        return {
          ...prev,
          inactivityDuration,
          isActive: inactivityDuration < 30,
        };
      });
    }, 1000);

    return () => {
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
      }
    };
  }, [mergedConfig, playAlertSound]);

  useEffect(() => {
    if (!mergedConfig.enabled) return;

    absenceTimerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.isTabVisible) return prev;

        const absenceDuration = absenceStartRef.current 
          ? Math.floor((Date.now() - absenceStartRef.current) / 1000)
          : 0;

        const newTotalAbsence = prev.totalAbsenceTime + absenceDuration;
        
        if (newTotalAbsence >= mergedConfig.maxAbsenceTime) {
          mergedConfig.onMaxAbsenceReached();
        }

        return {
          ...prev,
          absenceDuration,
        };
      });
    }, 1000);

    return () => {
      if (absenceTimerRef.current) {
        clearInterval(absenceTimerRef.current);
      }
    };
  }, [mergedConfig]);

  useEffect(() => {
    if (!state.isShowingConfirmation || !mergedConfig.enabled) {
      if (confirmationTimerRef.current) {
        clearInterval(confirmationTimerRef.current);
        confirmationTimerRef.current = null;
      }
      return;
    }

    confirmationTimerRef.current = setInterval(() => {
      setState(prev => {
        const newCountdown = prev.confirmationCountdown - 1;
        
        if (newCountdown <= 0) {
          mergedConfig.onConfirmationTimeout();
          return {
            ...prev,
            confirmationCountdown: 0,
            isShowingConfirmation: false,
          };
        }

        if (newCountdown <= 30 && newCountdown % 10 === 0) {
          playAlertSound();
        }

        return {
          ...prev,
          confirmationCountdown: newCountdown,
        };
      });
    }, 1000);

    return () => {
      if (confirmationTimerRef.current) {
        clearInterval(confirmationTimerRef.current);
      }
    };
  }, [state.isShowingConfirmation, mergedConfig, playAlertSound]);

  useEffect(() => {
    const checkTotalAbsence = () => {
      const currentAbsence = absenceStartRef.current 
        ? Math.floor((Date.now() - absenceStartRef.current) / 1000)
        : 0;
      const total = state.totalAbsenceTime + currentAbsence;
      
      if (total >= mergedConfig.maxAbsenceTime && mergedConfig.enabled) {
        mergedConfig.onMaxAbsenceReached();
      }
    };

    const interval = setInterval(checkTotalAbsence, 1000);
    return () => clearInterval(interval);
  }, [state.totalAbsenceTime, mergedConfig]);

  return {
    state,
    confirmPresence,
    resetActivity,
    playAlertSound,
    dismissReturnModal,
    getCurrentAbsenceTime: () => {
      const currentAbsence = absenceStartRef.current 
        ? Math.floor((Date.now() - absenceStartRef.current) / 1000)
        : 0;
      return state.totalAbsenceTime + currentAbsence;
    },
  };
}

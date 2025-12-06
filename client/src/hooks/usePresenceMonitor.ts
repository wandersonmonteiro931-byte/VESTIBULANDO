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
  inactivityTimeout: number; // seconds before showing confirmation (default: 180 = 3 min)
  confirmationTimeout: number; // seconds to confirm presence (default: 120 = 2 min)
  maxAbsenceTime: number; // max total absence time before removal (default: 300 = 5 min)
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAlertSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.src = "data:audio/wav;base64,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";
      }
      audioRef.current.volume = 0.3;
      audioRef.current.play().catch(() => {});
    } catch (e) {
      console.log("Could not play alert sound");
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
    if (absenceSoundIntervalRef.current) {
      clearInterval(absenceSoundIntervalRef.current);
    }
    playAlertSound();
    absenceSoundIntervalRef.current = setInterval(() => {
      playAlertSound();
    }, 5000);
  }, [playAlertSound]);

  const stopIntermittentSound = useCallback(() => {
    if (absenceSoundIntervalRef.current) {
      clearInterval(absenceSoundIntervalRef.current);
      absenceSoundIntervalRef.current = null;
    }
  }, []);

  const dismissReturnModal = useCallback(() => {
    setState(prev => ({ ...prev, showReturnModal: false }));
  }, []);

  const handleVisibilityChange = useCallback(() => {
    const isVisible = document.visibilityState === "visible";
    
    if (!isVisible && mergedConfig.enabled) {
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

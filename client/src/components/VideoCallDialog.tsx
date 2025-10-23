import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Phone, Video, Mic, MicOff, VideoOff, PhoneOff } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, orderBy, updateDoc, doc } from "firebase/firestore";
import { CallSignal } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface VideoCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientName: string;
  recipientId: string;
  isVideoCall: boolean;
}

type CallStatus = "calling" | "ringing" | "connected" | "ended" | "rejected";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function VideoCallDialog({
  open,
  onOpenChange,
  recipientName,
  recipientId,
  isVideoCall,
}: VideoCallDialogProps) {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [callStatus, setCallStatus] = useState<CallStatus>("calling");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoCall);
  const [callDuration, setCallDuration] = useState(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string>("");
  const callStartTimeRef = useRef<number>(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (open && userData) {
      initializeCall();
    }

    return () => {
      cleanup();
    };
  }, [open]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === "connected") {
      interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const initializeCall = async () => {
    try {
      callIdRef.current = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const constraints = {
        audio: true,
        video: isVideoCall,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      peerConnectionRef.current = new RTCPeerConnection(ICE_SERVERS);

      stream.getTracks().forEach((track) => {
        peerConnectionRef.current!.addTrack(track, stream);
      });

      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({
            callId: callIdRef.current,
            callerId: userData!.uid,
            callerName: userData!.nome,
            receiverId: recipientId,
            receiverName: recipientName,
            type: "ice-candidate",
            data: event.candidate.toJSON(),
            timestamp: Date.now(),
            read: false,
          });
        }
      };

      peerConnectionRef.current.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      peerConnectionRef.current.onconnectionstatechange = () => {
        const state = peerConnectionRef.current?.connectionState;
        if (state === "connected") {
          setCallStatus("connected");
          callStartTimeRef.current = Date.now();
        } else if (state === "disconnected" || state === "failed" || state === "closed") {
          handleEndCall();
        }
      };

      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      await sendSignal({
        callId: callIdRef.current,
        callerId: userData!.uid,
        callerName: userData!.nome,
        receiverId: recipientId,
        receiverName: recipientName,
        type: "offer",
        data: offer,
        timestamp: Date.now(),
        read: false,
      });

      listenForSignals();
    } catch (error) {
      console.error("Erro ao inicializar chamada:", error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a chamada. Verifique as permissões de câmera/microfone.",
        variant: "destructive",
      });
      onOpenChange(false);
    }
  };

  const sendSignal = async (signal: Omit<CallSignal, "id">) => {
    try {
      await addDoc(collection(db, "call_signals"), signal);
    } catch (error) {
      console.error("Erro ao enviar sinal:", error);
    }
  };

  const listenForSignals = () => {
    const q = query(
      collection(db, "call_signals"),
      where("callId", "==", callIdRef.current),
      where("receiverId", "==", userData!.uid),
      orderBy("timestamp", "asc")
    );

    unsubscribeRef.current = onSnapshot(q, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === "added") {
          const signal = { id: change.doc.id, ...change.doc.data() } as CallSignal;
          
          if (!signal.read) {
            await updateDoc(doc(db, "call_signals", signal.id), { read: true });
            await handleSignal(signal);
          }
        }
      }
    });
  };

  const handleSignal = async (signal: CallSignal) => {
    try {
      if (signal.type === "answer" && peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(signal.data)
        );
      } else if (signal.type === "ice-candidate" && peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(signal.data)
        );
      } else if (signal.type === "end") {
        handleEndCall();
      } else if (signal.type === "reject") {
        setCallStatus("rejected");
        setTimeout(() => onOpenChange(false), 2000);
      }
    } catch (error) {
      console.error("Erro ao processar sinal:", error);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const handleEndCall = async () => {
    await sendSignal({
      callId: callIdRef.current,
      callerId: userData!.uid,
      callerName: userData!.nome,
      receiverId: recipientId,
      receiverName: recipientName,
      type: "end",
      data: null,
      timestamp: Date.now(),
      read: false,
    });

    cleanup();
    setCallStatus("ended");
    setTimeout(() => onOpenChange(false), 2000);
  };

  const cleanup = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusText = () => {
    switch (callStatus) {
      case "calling":
        return "Chamando...";
      case "ringing":
        return "Tocando...";
      case "connected":
        return formatDuration(callDuration);
      case "ended":
        return "Chamada encerrada";
      case "rejected":
        return "Chamada rejeitada";
      default:
        return "";
    }
  };

  const getStatusVariant = (): "default" | "secondary" | "destructive" => {
    switch (callStatus) {
      case "calling":
      case "ringing":
        return "secondary";
      case "connected":
        return "default";
      case "ended":
      case "rejected":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-video-call">
        <DialogHeader>
          <DialogTitle>
            {isVideoCall ? "Chamada de Vídeo" : "Chamada de Áudio"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src="" alt={recipientName} />
              <AvatarFallback>
                {recipientName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{recipientName}</h3>
              <Badge variant={getStatusVariant()} data-testid="badge-call-status">
                {getStatusText()}
              </Badge>
            </div>
          </div>

          {isVideoCall && (
            <div className="relative bg-muted rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                data-testid="video-remote"
              />
              <div className="absolute bottom-4 right-4 w-32 h-24 bg-black rounded-lg overflow-hidden border-2 border-white">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  data-testid="video-local"
                  style={{ transform: "scaleX(-1)" }}
                />
              </div>
            </div>
          )}

          {!isVideoCall && (
            <div className="h-48 bg-muted rounded-lg flex items-center justify-center">
              <Phone className="h-16 w-16 text-muted-foreground" />
              <video ref={localVideoRef} style={{ display: "none" }} autoPlay muted />
              <video ref={remoteVideoRef} style={{ display: "none" }} autoPlay />
            </div>
          )}

          <div className="flex items-center justify-center gap-4">
            <Button
              variant={isMuted ? "destructive" : "secondary"}
              size="icon"
              onClick={toggleMute}
              disabled={callStatus !== "connected" && callStatus !== "calling"}
              data-testid="button-toggle-mute"
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            {isVideoCall && (
              <Button
                variant={!isVideoEnabled ? "destructive" : "secondary"}
                size="icon"
                onClick={toggleVideo}
                disabled={callStatus !== "connected" && callStatus !== "calling"}
                data-testid="button-toggle-video"
              >
                {!isVideoEnabled ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </Button>
            )}

            <Button
              variant="destructive"
              size="icon"
              onClick={handleEndCall}
              disabled={callStatus === "ended" || callStatus === "rejected"}
              data-testid="button-end-call"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

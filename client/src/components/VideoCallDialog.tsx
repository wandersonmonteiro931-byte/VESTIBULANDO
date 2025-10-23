import { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface VideoCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientName: string;
  recipientId: string;
  isVideoCall?: boolean;
}

type CallStatus = "calling" | "connected" | "ended";

export function VideoCallDialog({
  open,
  onOpenChange,
  recipientName,
  recipientId,
  isVideoCall = true,
}: VideoCallDialogProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>("calling");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoCall);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) {
      setCallStatus("calling");
      setIsMuted(false);
      setIsVideoEnabled(isVideoCall);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      return;
    }

    const startLocalStream = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: true,
          video: isVideoCall,
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setTimeout(() => {
          setCallStatus("connected");
        }, 2000);
      } catch (error) {
        console.error("Erro ao acessar mídia:", error);
        onOpenChange(false);
      }
    };

    startLocalStream();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [open, isVideoCall, onOpenChange]);

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

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setCallStatus("ended");
    setTimeout(() => {
      onOpenChange(false);
    }, 500);
  };

  const getStatusText = () => {
    switch (callStatus) {
      case "calling":
        return "Chamando...";
      case "connected":
        return "Em chamada";
      case "ended":
        return "Chamada encerrada";
      default:
        return "";
    }
  };

  const getStatusVariant = (): "default" | "secondary" | "destructive" => {
    switch (callStatus) {
      case "calling":
        return "secondary";
      case "connected":
        return "default";
      case "ended":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{recipientName}</span>
            <Badge variant={getStatusVariant()}>{getStatusText()}</Badge>
          </DialogTitle>
          <DialogDescription>
            {isVideoCall ? "Chamada de vídeo" : "Chamada de áudio"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isVideoCall && (
              <>
                <div className="relative bg-muted rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-xs">
                    {recipientName}
                  </div>
                </div>

                <div className="relative bg-muted rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-xs">
                    Você
                  </div>
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <VideoOff className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </>
            )}

            {!isVideoCall && (
              <div className="col-span-2 flex items-center justify-center py-20 bg-muted rounded-lg">
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="h-12 w-12 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{recipientName}</p>
                    <p className="text-sm text-muted-foreground">{getStatusText()}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-4">
            <Button
              variant={isMuted ? "destructive" : "outline"}
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={toggleMute}
              data-testid="button-toggle-mute"
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            {isVideoCall && (
              <Button
                variant={!isVideoEnabled ? "destructive" : "outline"}
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={toggleVideo}
                data-testid="button-toggle-video"
              >
                {isVideoEnabled ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <VideoOff className="h-5 w-5" />
                )}
              </Button>
            )}

            <Button
              variant="destructive"
              size="icon"
              className="h-14 w-14 rounded-full"
              onClick={endCall}
              data-testid="button-end-call"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

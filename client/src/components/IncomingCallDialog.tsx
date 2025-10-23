import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, PhoneOff, VideoIcon } from "lucide-react";
import { CallSignal } from "@shared/schema";

interface IncomingCallDialogProps {
  open: boolean;
  callSignal: CallSignal | null;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallDialog({
  open,
  callSignal,
  onAccept,
  onReject,
}: IncomingCallDialogProps) {
  if (!callSignal) return null;

  const isVideoCall = callSignal.data?.video !== false;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src="" alt={callSignal.callerName} />
              <AvatarFallback>
                {callSignal.callerName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="text-lg font-semibold">{callSignal.callerName}</p>
              <p className="text-sm text-muted-foreground">
                {isVideoCall ? "Chamada de vídeo recebida" : "Chamada de áudio recebida"}
              </p>
            </div>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center py-4">
            {isVideoCall ? (
              <VideoIcon className="h-16 w-16 mx-auto text-primary animate-pulse" />
            ) : (
              <Phone className="h-16 w-16 mx-auto text-primary animate-pulse" />
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-4">
          <AlertDialogCancel
            onClick={onReject}
            className="flex-1"
            data-testid="button-reject-call"
          >
            <PhoneOff className="h-4 w-4 mr-2" />
            Rejeitar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onAccept}
            className="flex-1"
            data-testid="button-accept-call"
          >
            <Phone className="h-4 w-4 mr-2" />
            Atender
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  updateDoc,
  doc,
  orderBy,
  Timestamp
} from "firebase/firestore";

interface WebRTCConfig {
  sessionId: string;
  userId: string;
  userNome: string;
  userTipo: "professor" | "aluno";
  isTeacher: boolean;
}

interface PeerConnection {
  peerId: string;
  peerNome: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function useWebRTC(config: WebRTCConfig | null) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [participants, setParticipants] = useState<{id: string; nome: string; cameraOn: boolean; micOn: boolean}[]>([]);
  
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const pendingIceCandidatesRef = useRef<Map<string, Array<{signalId: string; candidate: RTCIceCandidateInit}>>>(new Map());

  const formatBrasiliaTime = () => {
    return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  };

  const createPeerConnection = useCallback((peerId: string, peerNome: string): RTCPeerConnection => {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) {
      return existing.connection;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = async (event) => {
      if (event.candidate && config) {
        try {
          await addDoc(collection(db, "webrtcSignals"), {
            sessaoId: config.sessionId,
            fromUserId: config.userId,
            fromUserNome: config.userNome,
            fromUserTipo: config.userTipo,
            toUserId: peerId,
            tipo: "ice-candidate",
            data: JSON.stringify(event.candidate),
            timestamp: formatBrasiliaTime(),
            processado: false,
          });
        } catch (error) {
          console.error("Error sending ICE candidate:", error);
        }
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.set(peerId, event.streams[0]);
          return newMap;
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        peerConnectionsRef.current.delete(peerId);
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(peerId);
          return newMap;
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${peerId}: ${pc.iceConnectionState}`);
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, screenStreamRef.current!);
      });
    }

    peerConnectionsRef.current.set(peerId, { peerId, peerNome, connection: pc });
    return pc;
  }, [config]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsCameraOn(true);
      setIsMicOn(true);

      peerConnectionsRef.current.forEach(({ connection }) => {
        stream.getTracks().forEach(track => {
          const senders = connection.getSenders();
          const existingSender = senders.find(s => s.track?.kind === track.kind);
          if (existingSender) {
            existingSender.replaceTrack(track);
          } else {
            connection.addTrack(track, stream);
          }
        });
      });

      return stream;
    } catch (error) {
      console.error("Error starting camera:", error);
      throw error;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      localStreamRef.current = null;
      setIsCameraOn(false);
      setIsMicOn(false);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  }, []);

  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
        },
        audio: true,
      });

      setScreenStream(stream);
      screenStreamRef.current = stream;
      setIsScreenSharing(true);

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      peerConnectionsRef.current.forEach(({ connection }) => {
        stream.getTracks().forEach(track => {
          connection.addTrack(track, stream);
        });
      });

      return stream;
    } catch (error) {
      console.error("Error starting screen share:", error);
      throw error;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      screenStreamRef.current = null;
      setIsScreenSharing(false);
    }
  }, []);

  const applyPendingIceCandidates = useCallback(async (peerId: string) => {
    const pending = pendingIceCandidatesRef.current.get(peerId);
    if (!pending || pending.length === 0) return;
    
    const peerConnection = peerConnectionsRef.current.get(peerId);
    if (!peerConnection || !peerConnection.connection.remoteDescription) return;
    
    for (const { signalId, candidate } of pending) {
      try {
        await peerConnection.connection.addIceCandidate(new RTCIceCandidate(candidate));
        await updateDoc(doc(db, "webrtcSignals", signalId), { processado: true });
        console.log(`Applied pending ICE candidate from ${peerId}`);
      } catch (error) {
        console.error("Error applying pending ICE candidate:", error);
      }
    }
    pendingIceCandidatesRef.current.delete(peerId);
  }, []);

  const sendOffer = useCallback(async (peerId: string, peerNome: string) => {
    if (!config) return;
    
    const pc = createPeerConnection(peerId, peerNome);
    
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      await addDoc(collection(db, "webrtcSignals"), {
        sessaoId: config.sessionId,
        fromUserId: config.userId,
        fromUserNome: config.userNome,
        fromUserTipo: config.userTipo,
        toUserId: peerId,
        tipo: "offer",
        data: JSON.stringify(offer),
        timestamp: formatBrasiliaTime(),
        processado: false,
      });
      
      console.log(`Offer sent to ${peerId}`);
    } catch (error) {
      console.error("Error sending offer:", error);
    }
  }, [config, createPeerConnection]);

  const handleOffer = useCallback(async (signalId: string, fromUserId: string, fromUserNome: string, offer: RTCSessionDescriptionInit) => {
    if (!config) return;
    if (processedSignalsRef.current.has(signalId)) return;
    processedSignalsRef.current.add(signalId);
    
    const pc = createPeerConnection(fromUserId, fromUserNome);
    
    try {
      if (pc.signalingState !== "stable") {
        console.log("Skipping offer, connection not stable");
        return;
      }
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      await applyPendingIceCandidates(fromUserId);
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await addDoc(collection(db, "webrtcSignals"), {
        sessaoId: config.sessionId,
        fromUserId: config.userId,
        fromUserNome: config.userNome,
        fromUserTipo: config.userTipo,
        toUserId: fromUserId,
        tipo: "answer",
        data: JSON.stringify(answer),
        timestamp: formatBrasiliaTime(),
        processado: false,
      });

      await updateDoc(doc(db, "webrtcSignals", signalId), { processado: true });
      
      console.log(`Answer sent to ${fromUserId}`);
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  }, [config, createPeerConnection, applyPendingIceCandidates]);

  const handleAnswer = useCallback(async (signalId: string, fromUserId: string, answer: RTCSessionDescriptionInit) => {
    if (processedSignalsRef.current.has(signalId)) return;
    processedSignalsRef.current.add(signalId);
    
    const peerConnection = peerConnectionsRef.current.get(fromUserId);
    if (peerConnection) {
      try {
        if (peerConnection.connection.signalingState === "have-local-offer") {
          await peerConnection.connection.setRemoteDescription(new RTCSessionDescription(answer));
          await updateDoc(doc(db, "webrtcSignals", signalId), { processado: true });
          console.log(`Answer received from ${fromUserId}`);
          
          await applyPendingIceCandidates(fromUserId);
        }
      } catch (error) {
        console.error("Error handling answer:", error);
      }
    }
  }, [applyPendingIceCandidates]);

  const handleIceCandidate = useCallback(async (signalId: string, fromUserId: string, candidate: RTCIceCandidateInit) => {
    if (processedSignalsRef.current.has(signalId)) return;
    processedSignalsRef.current.add(signalId);
    
    const peerConnection = peerConnectionsRef.current.get(fromUserId);
    if (peerConnection && peerConnection.connection.remoteDescription) {
      try {
        await peerConnection.connection.addIceCandidate(new RTCIceCandidate(candidate));
        await updateDoc(doc(db, "webrtcSignals", signalId), { processado: true });
        console.log(`Added ICE candidate from ${fromUserId}`);
      } catch (error) {
        console.error("Error handling ICE candidate:", error);
      }
    } else {
      const pending = pendingIceCandidatesRef.current.get(fromUserId) || [];
      pending.push({ signalId, candidate });
      pendingIceCandidatesRef.current.set(fromUserId, pending);
      console.log(`Buffered ICE candidate from ${fromUserId} (waiting for remote description)`);
    }
  }, []);

  const announceJoin = useCallback(async () => {
    if (!config) return;
    
    await addDoc(collection(db, "webrtcSignals"), {
      sessaoId: config.sessionId,
      fromUserId: config.userId,
      fromUserNome: config.userNome,
      fromUserTipo: config.userTipo,
      toUserId: "all",
      tipo: "user-joined",
      data: JSON.stringify({ userId: config.userId, userNome: config.userNome, userTipo: config.userTipo }),
      timestamp: formatBrasiliaTime(),
      processado: false,
    });
    
    console.log("Announced join");
  }, [config]);

  const announceLeave = useCallback(async () => {
    if (!config) return;
    
    await addDoc(collection(db, "webrtcSignals"), {
      sessaoId: config.sessionId,
      fromUserId: config.userId,
      fromUserNome: config.userNome,
      fromUserTipo: config.userTipo,
      toUserId: "all",
      tipo: "user-left",
      data: JSON.stringify({ userId: config.userId }),
      timestamp: formatBrasiliaTime(),
      processado: false,
    });
  }, [config]);

  const cleanup = useCallback(() => {
    stopCamera();
    stopScreenShare();
    
    peerConnectionsRef.current.forEach(({ connection }) => {
      connection.close();
    });
    peerConnectionsRef.current.clear();
    processedSignalsRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    setRemoteStreams(new Map());
    setParticipants([]);
  }, [stopCamera, stopScreenShare]);

  useEffect(() => {
    if (!config) return;

    const signalsRef = collection(db, "webrtcSignals");
    const q = query(
      signalsRef,
      where("sessaoId", "==", config.sessionId),
      where("processado", "==", false),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === "added") {
          const signalData = change.doc.data();
          const signalId = change.doc.id;

          if (signalData.fromUserId === config.userId) continue;
          
          if (signalData.toUserId !== "all" && signalData.toUserId !== config.userId) continue;

          try {
            switch (signalData.tipo) {
              case "offer":
                await handleOffer(
                  signalId,
                  signalData.fromUserId,
                  signalData.fromUserNome,
                  JSON.parse(signalData.data)
                );
                break;
              case "answer":
                await handleAnswer(signalId, signalData.fromUserId, JSON.parse(signalData.data));
                break;
              case "ice-candidate":
                await handleIceCandidate(signalId, signalData.fromUserId, JSON.parse(signalData.data));
                break;
              case "user-joined":
                const joinData = JSON.parse(signalData.data);
                if (config.isTeacher && joinData.userTipo === "aluno") {
                  await sendOffer(signalData.fromUserId, signalData.fromUserNome);
                }
                setParticipants(prev => {
                  if (!prev.find(p => p.id === joinData.userId)) {
                    return [...prev, { id: joinData.userId, nome: joinData.userNome, cameraOn: false, micOn: false }];
                  }
                  return prev;
                });
                await updateDoc(doc(db, "webrtcSignals", signalId), { processado: true });
                break;
              case "user-left":
                const leaveData = JSON.parse(signalData.data);
                peerConnectionsRef.current.get(leaveData.userId)?.connection.close();
                peerConnectionsRef.current.delete(leaveData.userId);
                setRemoteStreams(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(leaveData.userId);
                  return newMap;
                });
                setParticipants(prev => prev.filter(p => p.id !== leaveData.userId));
                await updateDoc(doc(db, "webrtcSignals", signalId), { processado: true });
                break;
            }
          } catch (error) {
            console.error("Error processing signal:", error);
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [config, handleOffer, handleAnswer, handleIceCandidate, sendOffer]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    localStream,
    screenStream,
    remoteStreams,
    isScreenSharing,
    isCameraOn,
    isMicOn,
    participants,
    startCamera,
    stopCamera,
    toggleCamera,
    toggleMic,
    startScreenShare,
    stopScreenShare,
    announceJoin,
    announceLeave,
    sendOffer,
    cleanup,
  };
}

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseWebRTCOptions {
  callType: 'audio' | 'video';
  onRemoteStream?: (stream: MediaStream) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  isConnecting: boolean;
  isConnected: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  error: string | null;
  initializeMedia: () => Promise<MediaStream | null>;
  createOffer: () => Promise<RTCSessionDescriptionInit | null>;
  createAnswer: (offer: RTCSessionDescriptionInit) => Promise<RTCSessionDescriptionInit | null>;
  setRemoteAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>;
  addIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Metered TURN servers (free tier)
    {
      urls: 'turn:a.relay.metered.ca:80',
      username: 'e8dd65a92deab1741b742a1e',
      credential: '4F0LHfMxVq/3mGcN',
    },
    {
      urls: 'turn:a.relay.metered.ca:80?transport=tcp',
      username: 'e8dd65a92deab1741b742a1e',
      credential: '4F0LHfMxVq/3mGcN',
    },
    {
      urls: 'turn:a.relay.metered.ca:443',
      username: 'e8dd65a92deab1741b742a1e',
      credential: '4F0LHfMxVq/3mGcN',
    },
    {
      urls: 'turns:a.relay.metered.ca:443?transport=tcp',
      username: 'e8dd65a92deab1741b742a1e',
      credential: '4F0LHfMxVq/3mGcN',
    },
  ],
  iceCandidatePoolSize: 10,
};

export const useWebRTC = ({
  callType,
  onRemoteStream,
  onIceCandidate,
  onConnectionStateChange,
}: UseWebRTCOptions): UseWebRTCReturn => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const isScreenSharingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const remoteDescriptionSetRef = useRef<boolean>(false);
  const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  // Store callbacks in refs to avoid stale closures in PC event handlers
  const onRemoteStreamRef = useRef(onRemoteStream);
  const onIceCandidateRef = useRef(onIceCandidate);
  const onConnectionStateChangeRef = useRef(onConnectionStateChange);

  useEffect(() => { onRemoteStreamRef.current = onRemoteStream; }, [onRemoteStream]);
  useEffect(() => { onIceCandidateRef.current = onIceCandidate; }, [onIceCandidate]);
  useEffect(() => { onConnectionStateChangeRef.current = onConnectionStateChange; }, [onConnectionStateChange]);

  // Initialize media devices — stable identity (only depends on callType)
  const initializeMedia = useCallback(async (): Promise<MediaStream | null> => {
    setIsConnecting(true);
    setError(null);

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: callType === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;

      if (callType === 'video') {
        originalVideoTrackRef.current = stream.getVideoTracks()[0] || null;
      }

      // Create peer connection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      // Add local tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream — read from ref to avoid stale closure
      pc.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        const [remoteMediaStream] = event.streams;
        setRemoteStream(remoteMediaStream);
        onRemoteStreamRef.current?.(remoteMediaStream);
      };

      // Handle ICE candidates — read from ref
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('ICE candidate:', event.candidate);
          onIceCandidateRef.current?.(event.candidate.toJSON());
        }
      };

      // Handle connection state changes — read from ref
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        onConnectionStateChangeRef.current?.(pc.connectionState);

        if (pc.connectionState === 'connected') {
          setIsConnected(true);
          setIsConnecting(false);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setIsConnected(false);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected') {
          setIsConnected(true);
          setIsConnecting(false);
        }
      };

      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError(err instanceof Error ? err.message : 'Failed to access camera/microphone');
      setIsConnecting(false);
      return null;
    }
  }, [callType]);

  // Create offer (for caller)
  const createOffer = useCallback(async (): Promise<RTCSessionDescriptionInit | null> => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('No peer connection');
      return null;
    }

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      });
      await pc.setLocalDescription(offer);
      console.log('Created offer');
      return offer;
    } catch (err) {
      console.error('Error creating offer:', err);
      setError('Failed to create call offer');
      return null;
    }
  }, [callType]);

  // Create answer (for callee)
  const createAnswer = useCallback(async (
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit | null> => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('No peer connection');
      return null;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      remoteDescriptionSetRef.current = true;

      // Flush any queued candidates
      for (const candidate of queuedCandidatesRef.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding queued ICE candidate:', err);
        }
      }
      queuedCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('Created answer');
      return answer;
    } catch (err) {
      console.error('Error creating answer:', err);
      setError('Failed to answer call');
      return null;
    }
  }, []);

  // Set remote answer (for caller after callee answers)
  const setRemoteAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('No peer connection');
      return;
    }

    try {
      // Guard against applying answer twice
      if (pc.signalingState !== 'have-local-offer') {
        console.warn('Skipping setRemoteAnswer — signalingState:', pc.signalingState);
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      remoteDescriptionSetRef.current = true;

      // Flush any queued candidates
      for (const candidate of queuedCandidatesRef.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding queued ICE candidate:', err);
        }
      }
      queuedCandidatesRef.current = [];

      console.log('Set remote answer');
    } catch (err) {
      console.error('Error setting remote answer:', err);
      setError('Failed to establish connection');
    }
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('No peer connection');
      return;
    }

    if (!remoteDescriptionSetRef.current) {
      console.log('Queueing ICE candidate (remote description not set yet)');
      queuedCandidatesRef.current.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('Added ICE candidate');
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  }, []);

  // End the call
  const endCall = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    localStreamRef.current = null;
    isScreenSharingRef.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setIsConnecting(false);
    setIsMuted(false);
    setIsVideoOff(callType === 'audio');
    setIsScreenSharing(false);
    setError(null);
    remoteDescriptionSetRef.current = false;
    queuedCandidatesRef.current = [];
  }, [callType]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(prev => !prev);
    }
  }, []);

  // Stop screen sharing helper
  const stopScreenSharing = useCallback(async () => {
    const pc = peerConnectionRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream) return;

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      const newVideoTrack = cameraStream.getVideoTracks()[0];

      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(newVideoTrack);

      const currentVideoTrack = stream.getVideoTracks()[0];
      if (currentVideoTrack) stream.removeTrack(currentVideoTrack);
      stream.addTrack(newVideoTrack);
      originalVideoTrackRef.current = newVideoTrack;
    } catch (err) {
      console.error('Error restoring camera after screen share:', err);
    }

    isScreenSharingRef.current = false;
    setIsScreenSharing(false);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const stream = localStreamRef.current;
    const pc = peerConnectionRef.current;
    if (!stream || !pc) return;

    try {
      if (isScreenSharingRef.current) {
        await stopScreenSharing();
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });

        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        screenTrack.onended = () => { stopScreenSharing(); };

        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);

        const currentVideoTrack = stream.getVideoTracks()[0];
        if (currentVideoTrack) stream.removeTrack(currentVideoTrack);
        stream.addTrack(screenTrack);

        isScreenSharingRef.current = true;
        setIsScreenSharing(true);
        setIsVideoOff(false);
      }
    } catch (err) {
      console.error('Error toggling screen share:', err);
      if (err instanceof Error && err.name !== 'NotAllowedError') {
        setError('Failed to share screen');
      }
    }
  }, [stopScreenSharing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  return {
    localStream,
    remoteStream,
    peerConnection: peerConnectionRef.current,
    isConnecting,
    isConnected,
    isMuted,
    isVideoOff,
    isScreenSharing,
    error,
    initializeMedia,
    createOffer,
    createAnswer,
    setRemoteAnswer,
    addIceCandidate,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  };
};

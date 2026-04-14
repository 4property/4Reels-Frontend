import { useCallback, useEffect, useRef, useState } from "react";

const MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function getSupportedMimeType() {
  if (
    typeof window === "undefined" ||
    typeof window.MediaRecorder === "undefined"
  ) {
    return "";
  }

  return (
    MIME_TYPE_CANDIDATES.find((mimeType) =>
      window.MediaRecorder.isTypeSupported(mimeType),
    ) ?? ""
  );
}

function getAudioExtension(mimeType) {
  if (mimeType.includes("mp4")) {
    return "m4a";
  }

  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  return "webm";
}

function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function getRecorderErrorMessage(error) {
  if (error?.message === "MEDIA_DEVICES_UNSUPPORTED") {
    return "Le navigateur ne donne pas acces au microphone.";
  }

  if (error?.name === "NotAllowedError") {
    return "L'acces au microphone a ete refuse.";
  }

  if (error?.name === "NotFoundError") {
    return "Aucun microphone n'a ete detecte.";
  }

  if (error?.name === "NotReadableError") {
    return "Le microphone est deja utilise par une autre application.";
  }

  return "Impossible d'enregistrer le son sur ce navigateur.";
}

function waitForTrackToBeReady(stream) {
  const [track] = stream.getAudioTracks();

  if (!track || track.readyState === "ended" || track.muted === false) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(resolve, 1000);

    const handleReady = () => {
      window.clearTimeout(timeoutId);
      track.removeEventListener("unmute", handleReady);
      resolve();
    };

    track.addEventListener("unmute", handleReady, { once: true });
  });
}

export function useAudioRecorder() {
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const audioUrlRef = useRef(null);
  const mimeTypeRef = useRef("");
  const startAttemptRef = useRef(0);
  const shouldStopAfterStartRef = useRef(false);
  const isMountedRef = useRef(true);
  const isRecordingRef = useRef(false);
  const isPreparingRef = useRef(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioMimeType, setAudioMimeType] = useState("");
  const [error, setError] = useState(null);

  const setRecordingState = useCallback((nextValue) => {
    isRecordingRef.current = nextValue;
    setIsRecording(nextValue);
  }, []);

  const setPreparingState = useCallback((nextValue) => {
    isPreparingRef.current = nextValue;
    setIsPreparing(nextValue);
  }, []);

  const clearAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const resetRecorder = useCallback(() => {
    if (!mediaRecorderRef.current) {
      return;
    }

    mediaRecorderRef.current.ondataavailable = null;
    mediaRecorderRef.current.onerror = null;
    mediaRecorderRef.current.onstart = null;
    mediaRecorderRef.current.onstop = null;
    mediaRecorderRef.current = null;
  }, []);

  const releaseStream = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  const ensureStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("MEDIA_DEVICES_UNSUPPORTED");
    }

    const currentStream = streamRef.current;
    const hasLiveTrack = currentStream
      ?.getAudioTracks()
      .some((track) => track.readyState === "live");

    if (currentStream && hasLiveTrack) {
      return currentStream;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    streamRef.current = stream;
    return stream;
  }, []);

  const finalizeAudio = useCallback(
    (finalMimeType = "") => {
      const currentMimeType =
        finalMimeType || mimeTypeRef.current || "audio/webm";

      clearAudioUrl();

      if (!chunksRef.current.length) {
        setAudioUrl(null);
        return;
      }

      const audioBlob = new Blob(chunksRef.current, { type: currentMimeType });
      const nextAudioUrl = URL.createObjectURL(audioBlob);

      chunksRef.current = [];
      audioUrlRef.current = nextAudioUrl;
      setAudioUrl(nextAudioUrl);
    },
    [clearAudioUrl],
  );

  const prepareRecording = useCallback(async () => {
    const stream = await ensureStream();
    await waitForTrackToBeReady(stream);
    return stream;
  }, [ensureStream]);

  const stopRecording = useCallback(() => {
    shouldStopAfterStartRef.current = true;

    const mediaRecorder = mediaRecorderRef.current;

    if (!mediaRecorder) {
      setPreparingState(false);
      setRecordingState(false);
      releaseStream();
      return;
    }

    if (mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      return;
    }

    if (mediaRecorder.state === "inactive") {
      resetRecorder();
      releaseStream();
      setPreparingState(false);
      setRecordingState(false);
    }
  }, [releaseStream, resetRecorder, setPreparingState, setRecordingState]);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || isPreparingRef.current) {
      return;
    }

    if (
      typeof window === "undefined" ||
      typeof window.MediaRecorder === "undefined"
    ) {
      setError("Ce navigateur ne prend pas en charge l'enregistrement audio.");
      return;
    }

    const existingRecorder = mediaRecorderRef.current;
    if (existingRecorder?.state === "recording") {
      return;
    }

    const attemptId = startAttemptRef.current + 1;
    startAttemptRef.current = attemptId;
    shouldStopAfterStartRef.current = false;
    setError(null);
    setPreparingState(true);

    try {
      const stream = await prepareRecording();

      if (
        shouldStopAfterStartRef.current ||
        startAttemptRef.current !== attemptId ||
        !isMountedRef.current
      ) {
        releaseStream();
        setPreparingState(false);
        return;
      }

      const requestedMimeType = getSupportedMimeType();
      chunksRef.current = [];

      const recorderOptions = requestedMimeType
        ? { mimeType: requestedMimeType }
        : undefined;
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      const resolvedMimeType =
        mediaRecorder.mimeType || requestedMimeType || "audio/webm";

      mediaRecorderRef.current = mediaRecorder;
      mimeTypeRef.current = resolvedMimeType;
      setAudioMimeType(resolvedMimeType);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("Erreur MediaRecorder :", event);
        setError("L'enregistrement audio a echoue.");
        setPreparingState(false);
        setRecordingState(false);
      };

      mediaRecorder.onstart = () => {
        if (!isMountedRef.current) {
          return;
        }

        setPreparingState(false);
        setRecordingState(true);
      };

      mediaRecorder.onstop = () => {
        finalizeAudio(mediaRecorder.mimeType || resolvedMimeType);
        resetRecorder();
        releaseStream();

        if (!isMountedRef.current) {
          return;
        }

        setPreparingState(false);
        setRecordingState(false);
      };

      mediaRecorder.start(250);
    } catch (recordingError) {
      console.error("Erreur micro :", recordingError);
      releaseStream();
      resetRecorder();

      if (!isMountedRef.current) {
        return;
      }

      setPreparingState(false);
      setRecordingState(false);
      setAudioMimeType("");
      setError(getRecorderErrorMessage(recordingError));
    }
  }, [
    finalizeAudio,
    prepareRecording,
    releaseStream,
    resetRecorder,
    setPreparingState,
    setRecordingState,
  ]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      shouldStopAfterStartRef.current = true;

      const mediaRecorder = mediaRecorderRef.current;

      if (mediaRecorder?.state === "recording") {
        try {
          mediaRecorder.stop();
        } catch (stopError) {
          console.error(
            "Impossible d'arreter proprement l'enregistrement :",
            stopError,
          );
          resetRecorder();
          releaseStream();
        }
      } else {
        resetRecorder();
        releaseStream();
      }

      clearAudioUrl();
    };
  }, [clearAudioUrl, releaseStream, resetRecorder]);

  return {
    audioExtension: getAudioExtension(audioMimeType),
    audioUrl,
    error,
    isPreparing,
    isRecording,
    startRecording,
    stopRecording,
  };
}

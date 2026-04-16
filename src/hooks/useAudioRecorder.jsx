import { useCallback, useEffect, useRef, useState } from "react";

const MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];
const DEFAULT_VISUALIZATION = {
  barCount: 10,
  exponent: 0.85,
  fftSize: 2048,
  gain: 1.4,
  maxDecibels: -18,
  maxFrequency: 10000,
  minDecibels: -90,
  minFrequency: 60,
  noiseFloor: 0.03,
  smoothingTimeConstant: 0.82,
};

function getInitialFrequencyBars(barCount) {
  return Array.from({ length: barCount }, () => 0);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getAudioContextClass() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.AudioContext || window.webkitAudioContext || null;
}

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
    return "This browser does not support audio recording.";
  }

  if (error?.name === "NotAllowedError") {
    return "Microphone access was denied. Please allow access and try again.";
  }

  if (error?.name === "NotFoundError") {
    return "No microphone was detected.";
  }

  if (error?.name === "NotReadableError") {
    return "The microphone is already in use by another application.";
  }

  return "Impossible to start audio recording. Please check your microphone and try again.";
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

function getFrequencyIndex(frequency, sampleRate, frequencyBinCount) {
  const nyquistFrequency = sampleRate / 2;
  const normalizedFrequency = clamp(
    frequency / nyquistFrequency,
    0,
    1,
  );

  return Math.round(normalizedFrequency * (frequencyBinCount - 1));
}

function createFrequencyBandIndexes({
  barCount,
  frequencyBinCount,
  maxFrequency,
  minFrequency,
  sampleRate,
}) {
  const safeMinFrequency = clamp(minFrequency, 20, maxFrequency - 1);
  const safeMaxFrequency = Math.max(safeMinFrequency + 1, maxFrequency);
  const logMin = Math.log10(safeMinFrequency);
  const logMax = Math.log10(safeMaxFrequency);

  return Array.from({ length: barCount }, (_, index) => {
    const startFrequency =
      10 ** (logMin + ((logMax - logMin) * index) / barCount);
    const endFrequency =
      10 ** (logMin + ((logMax - logMin) * (index + 1)) / barCount);
    const startIndex = getFrequencyIndex(
      startFrequency,
      sampleRate,
      frequencyBinCount,
    );
    const endIndex = Math.max(
      startIndex,
      getFrequencyIndex(endFrequency, sampleRate, frequencyBinCount),
    );

    return { endIndex, startIndex };
  });
}

function getFrequencyBarLevel(
  frequencyData,
  startIndex,
  endIndex,
  { exponent, gain, noiseFloor },
) {
  const sampleCount = endIndex - startIndex + 1;

  if (sampleCount <= 0) {
    return 0;
  }

  let sum = 0;
  let peak = 0;

  for (let index = startIndex; index <= endIndex; index += 1) {
    const value = frequencyData[index] / 255;
    sum += value;
    peak = Math.max(peak, value);
  }

  const average = sum / sampleCount;
  const weightedLevel = average * 0.65 + peak * 0.35;
  const curvedLevel = Math.pow(clamp(weightedLevel * gain, 0, 1), exponent);

  if (curvedLevel <= noiseFloor) {
    return 0;
  }

  return clamp((curvedLevel - noiseFloor) / (1 - noiseFloor), 0, 1);
}

export function useAudioRecorder(options = {}) {
  const visualization = {
    ...DEFAULT_VISUALIZATION,
    ...(options.visualization ?? {}),
  };
  const {
    barCount,
    exponent,
    fftSize,
    gain,
    maxDecibels,
    maxFrequency,
    minDecibels,
    minFrequency,
    noiseFloor,
    smoothingTimeConstant,
  } = visualization;
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
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const animationFrameRef = useRef(null);
  const frequencyBarsRef = useRef(getInitialFrequencyBars(barCount));

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

  const resetFrequencyBars = useCallback(() => {
    frequencyBarsRef.current = getInitialFrequencyBars(barCount);
  }, [barCount]);

  const cleanupVisualizer = useCallback(
    (shouldResetLevels = true) => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }

      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }

      const audioContext = audioContextRef.current;
      audioContextRef.current = null;

      if (audioContext && audioContext.state !== "closed") {
        audioContext.close().catch((closeError) => {
          console.error("Error closing audio context:", closeError);
        });
      }

      if (shouldResetLevels) {
        resetFrequencyBars();
      }
    },
    [resetFrequencyBars],
  );

  const startVisualizer = useCallback(
    async (stream) => {
      const AudioContextClass = getAudioContextClass();

      if (!AudioContextClass) {
        resetFrequencyBars();
        return;
      }

      cleanupVisualizer(false);

      try {
        const audioContext = new AudioContextClass();
        const analyser = audioContext.createAnalyser();
        const sourceNode = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = fftSize;
        analyser.minDecibels = minDecibels;
        analyser.maxDecibels = maxDecibels;
        analyser.smoothingTimeConstant = smoothingTimeConstant;

        sourceNode.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        sourceNodeRef.current = sourceNode;

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        const frequencyBandIndexes = createFrequencyBandIndexes({
          barCount,
          frequencyBinCount: analyser.frequencyBinCount,
          maxFrequency,
          minFrequency,
          sampleRate: audioContext.sampleRate,
        });

        const updateFrequencyBars = () => {
          if (!analyserRef.current || !isMountedRef.current) {
            return;
          }

          analyser.getByteFrequencyData(frequencyData);

          frequencyBarsRef.current = frequencyBandIndexes.map(
            ({ endIndex, startIndex }) =>
              getFrequencyBarLevel(frequencyData, startIndex, endIndex, {
                exponent,
                gain,
                noiseFloor,
              }),
          );

          animationFrameRef.current =
            window.requestAnimationFrame(updateFrequencyBars);
        };

        updateFrequencyBars();
      } catch (visualizerError) {
        console.error("Audio visualizer error:", visualizerError);
        cleanupVisualizer(true);
      }
    },
    [
      barCount,
      cleanupVisualizer,
      exponent,
      fftSize,
      gain,
      maxDecibels,
      maxFrequency,
      minDecibels,
      minFrequency,
      noiseFloor,
      resetFrequencyBars,
      smoothingTimeConstant,
    ],
  );

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
      cleanupVisualizer();
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
      cleanupVisualizer();
      resetRecorder();
      releaseStream();
      setPreparingState(false);
      setRecordingState(false);
    }
  }, [
    cleanupVisualizer,
    releaseStream,
    resetRecorder,
    setPreparingState,
    setRecordingState,
  ]);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || isPreparingRef.current) {
      return;
    }

    if (
      typeof window === "undefined" ||
      typeof window.MediaRecorder === "undefined"
    ) {
      setError("This browser does not support audio recording.");
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
        cleanupVisualizer();
        releaseStream();
        setPreparingState(false);
        return;
      }

      await startVisualizer(stream);

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
        console.error("MediaRecorder error:", event);
        cleanupVisualizer();
        resetRecorder();
        releaseStream();
        setError("An error occurred during recording. Please try again.");
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
        cleanupVisualizer();
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
      console.error("Mic error:", recordingError);
      cleanupVisualizer();
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
    cleanupVisualizer,
    finalizeAudio,
    prepareRecording,
    releaseStream,
    resetRecorder,
    setPreparingState,
    setRecordingState,
    startVisualizer,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    resetFrequencyBars();

    return () => {
      isMountedRef.current = false;
      shouldStopAfterStartRef.current = true;

      const mediaRecorder = mediaRecorderRef.current;

      if (mediaRecorder?.state === "recording") {
        try {
          mediaRecorder.stop();
        } catch (stopError) {
          console.error(
            "Error stopping MediaRecorder during cleanup:",
            stopError,
          );
          cleanupVisualizer(false);
          resetRecorder();
          releaseStream();
        }
      } else {
        cleanupVisualizer(false);
        resetRecorder();
        releaseStream();
      }

      clearAudioUrl();
    };
  }, [cleanupVisualizer, clearAudioUrl, releaseStream, resetFrequencyBars, resetRecorder]);

  return {
    audioExtension: getAudioExtension(audioMimeType),
    audioUrl,
    error,
    frequencyBarCount: barCount,
    frequencyBarsRef,
    isPreparing,
    isRecording,
    startRecording,
    stopRecording,
  };
}

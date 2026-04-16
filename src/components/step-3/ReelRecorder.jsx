import { useEffect, useState } from "react";

import AudioRecorder from "./AudioRecorder";
import VideoPlayer from "./VideoPlayer";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";

const AUDIO_VISUALIZER_OPTIONS = {
  visualization: {
    barCount: 10,
    exponent: 0.82,
    gain: 1.5,
    maxFrequency: 12000,
    minFrequency: 50,
  },
};
const AUDIO_VISUALIZER_SCALE = {
  barWidth: 16,
  maxHeight: 112,
  minHeight: 16,
};

export default function ReelRecorder() {
  const [isStartRequested, setIsStartRequested] = useState(false);
  const {
    audioExtension,
    audioUrl,
    error,
    frequencyBarCount,
    frequencyBarsRef,
    isPreparing,
    isRecording,
    startRecording,
    stopRecording,
  } = useAudioRecorder(AUDIO_VISUALIZER_OPTIONS);

  useEffect(() => {
    if (isStartRequested) {
      startRecording();
      return;
    }

    stopRecording();
  }, [isStartRequested, startRecording, stopRecording]);

  function handleToggle() {
    setIsStartRequested((currentValue) => !currentValue);
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 xl:flex-row xl:gap-10">
      <div className="flex h-[min(54vh,44rem)] w-full max-w-[22rem] items-center justify-center">
        <VideoPlayer isRunning={isStartRequested && isRecording} />
      </div>

      <div className="flex w-full max-w-[28rem] flex-col gap-5">
        <AudioRecorder
          audioExtension={audioExtension}
          audioUrl={audioUrl}
          error={error}
          frequencyBarCount={frequencyBarCount}
          frequencyBarsRef={frequencyBarsRef}
          isPreparing={isPreparing}
          isRecording={isRecording}
          visualizerScale={AUDIO_VISUALIZER_SCALE}
        />

        <button
          onClick={handleToggle}
          className={`rounded-full border-2 px-5 py-3 text-sm font-semibold tracking-[0.2em] uppercase transition-colors ${
            isStartRequested
              ? "border-blue-950 bg-white text-blue-950"
              : "border-blue-950 bg-blue-950 text-white"
          }`}
        >
          {isStartRequested ? "Stop" : "Start"}
        </button>
      </div>
    </div>
  );
}

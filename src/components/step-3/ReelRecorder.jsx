import VideoPlayer from "./VideoPlayer";
import AudioRecorder from "./AudioRecorder";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";

import { useEffect, useState } from "react";

export default function ReelRecorder() {
  const [isStartRequested, setIsStartRequested] = useState(false);
  const {
    audioExtension,
    audioUrl,
    error,
    isPreparing,
    isRecording,
    startRecording,
    stopRecording,
  } = useAudioRecorder();

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
    <div className="flex w-full h-full items-center justify-center gap-10">
      <VideoPlayer isRunning={isStartRequested && isRecording} />
      <div className="flex flex-col justify-around h-full">
        <AudioRecorder
          audioExtension={audioExtension}
          audioUrl={audioUrl}
          error={error}
          isPreparing={isPreparing}
          isRecording={isRecording}
        />
        <button
          onClick={handleToggle}
          className={
            isStartRequested
              ? "bg-white border-2 border-blue-950 text-blue-950 px-4 py-2 rounded-full"
              : "bg-blue-950 border-2 border-blue-950 text-white px-4 py-2 rounded-full"
          }
        >
          {isStartRequested ? "Stop" : "Start"}
        </button>
      </div>
    </div>
  );
}

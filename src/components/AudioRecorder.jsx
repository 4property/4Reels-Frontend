import React, { useEffect } from "react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";

export default function AudioRecorder({ isRunning }) {
  const { isRecording, audioUrl, startRecording, stopRecording } =
    useAudioRecorder();

  useEffect(() => {
    if (isRunning) {
      startRecording();
    } else {
      stopRecording();
    }
  }, [isRunning]);

  return (
    <div>
      <h1>Audio recorder</h1>
      {audioUrl && (
        <div>
          <h2>Recorded Audio</h2>
          <audio controls src={audioUrl}></audio>
          <br />
        </div>
      )}
    </div>
  );
}

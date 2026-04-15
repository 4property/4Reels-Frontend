import React from "react";

export default function AudioRecorder({
  audioExtension,
  audioUrl,
  error,
  isPreparing,
  isRecording,
}) {
  return (
    <div>
      <h1>Audio recorder</h1>
      <p>
        {isPreparing && "Starting microphone..."}
        {!isPreparing && isRecording && "Recording audio..."}
        {!isPreparing && !isRecording && !error && "Ready to record."}
      </p>
      {error && <p className="text-red-500">{error}</p>}
      {audioUrl && (
        <div>
          <h2>Recorded Audio</h2>
          <audio controls preload="metadata" src={audioUrl}></audio>
          <p>Format: .{audioExtension}</p>
        </div>
      )}
    </div>
  );
}

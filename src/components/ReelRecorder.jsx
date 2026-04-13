import VideoPlayer from "./VideoPlayer";
import AudioRecorder from "./AudioRecorder";

// import { useState, useRef } from "react"; --- IGNORE ---
import { useState } from "react";

export default function ReelRecorder() {
  const [isRunning, setIsRunning] = useState(false);
  const [test, setTest] = useState("Hello");

  function handleToggle() {
    setIsRunning(!isRunning);
  }

  return (
    <>
      <VideoPlayer isRunning={isRunning} />
      <AudioRecorder isRunning={isRunning} />
      <button
        onClick={handleToggle}
        className={
          isRunning
            ? "bg-red-500 text-white px-4 py-2 rounded"
            : "bg-green-500 text-white px-4 py-2 rounded"
        }
      >
        {isRunning ? "Stop" : "Start"}
      </button>
    </>
  );
}

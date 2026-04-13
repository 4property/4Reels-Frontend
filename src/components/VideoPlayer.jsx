import video from "../assets/video.mp4";
import { useEffect, useRef } from "react";

export default function VideoPlayer({ isRunning }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;

    if (isRunning) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isRunning]);
  return (
    <video ref={videoRef} className="w-100 h-auto">
      <source src={video} type="video/mp4" />
    </video>
  );
}

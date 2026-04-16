import { memo, useEffect, useRef } from "react";

import video from "../../assets/video.mp4";

const VideoPlayer = memo(function VideoPlayer({ isRunning }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    if (isRunning) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isRunning]);

  return (
    <video ref={videoRef} className="h-full w-auto rounded-3xl">
      <source src={video} type="video/mp4" />
    </video>
  );
});

export default VideoPlayer;

import React from "react";

export default function ReelChoice() {
  const videoData = [
    // Just placeholder data for now, replace with actual API data when available
    {src: "src/assets/video.mp4", title: "Video 1", id: 1},
    {src: "src/assets/video.mp4", title: "Video 2", id: 2},
    {src: "src/assets/video.mp4", title: "Video 3", id: 3},
    {src: "src/assets/video.mp4", title: "Video 4", id: 4},
    {src: "src/assets/video.mp4", title: "Video 5", id: 5},
    {src: "src/assets/video.mp4", title: "Video 5", id: 5},
    {src: "src/assets/video.mp4", title: "Video 5", id: 5},
    {src: "src/assets/video.mp4", title: "Video 5", id: 5},
    {src: "src/assets/video.mp4", title: "Video 5", id: 5},
    
  ]; // This will hold the video data fetched from the API

  return (
    <>
      <div className="">Reelchoice</div>
      <ul className="w-full h-auto flex  gap-4 flex-wrap">
        {videoData.map((video) => (
          <li className="w-40" key={video.id}>
            <video src={video.src} title={video.title} />
          </li>
        ))}
      </ul>
    </>

  );
}

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
    <div className="flex">
      <div className="w-3/5">
        {/* <div className="">Reelchoice</div> */}
        <h1>My Reels and Posters</h1>
        <h2>Scheduled videos and posters:</h2>
        <div className="w-full max-h-140 overflow-y-auto border border-slate-200 rounded-xl p-4 m-4">
          <ul className="w-full h-auto flex gap-2 flex-wrap px-1 py-1">
            {videoData.map((video) => (
              <li className="w-40" key={video.id}>
                <video src={video.src} title={video.title} />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="w-2/5">
        <h2 className="p-2 m-4">Current Reel/Poster:</h2>
        <div className="w-full h-auto  p-2 m-4">
          <video className="w-50 px-1 py-1" src="src/assets/video.mp4" title="Current Reel" controls />
        </div>
      </div>
    </div>

  );
}

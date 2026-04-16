import { CircleArrowRight } from "lucide-react";
import React, { useState } from "react";

export default function ReelChoice() {
  const [isToggled1, setIsToggled1] = useState(false);
  const [isToggled2, setIsToggled2] = useState(false);

  const mediaData = [
    // Just placeholder data for now, replace with actual API data when available
    { src: "src/assets/video.mp4", title: "Video 1", id: 1, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 2", id: 2, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 3", id: 3, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 4", id: 4, type: "video" },
    {
      src: "src/assets/20-balally-close-dundrum-d16-k030-poster.jpg",
      title: "Poster 1",
      id: 5,
      type: "image",
    },
    { src: "src/assets/video.mp4", title: "Video 5", id: 6, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 6", id: 7, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 7", id: 8, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 8", id: 9, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 9", id: 10, type: "video" },
    {
      src: "src/assets/20-balally-close-dundrum-d16-k030-poster.jpg",
      title: "Poster 2",
      id: 11,
      type: "image",
    },
    {
      src: "src/assets/20-balally-close-dundrum-d16-k030-poster.jpg",
      title: "Poster 3",
      id: 12,
      type: "image",
    },
    {
      src: "src/assets/20-balally-close-dundrum-d16-k030-poster.jpg",
      title: "Poster 4",
      id: 13,
      type: "image",
    },
  ]; // This will hold the video data fetched from the API
  const [selectedVideo, setSelectedVideo] = useState(mediaData[0]); // State to hold the currently selected video, initialized to the first video in the list
  const handleVideoClick = (video) => {
    setSelectedVideo(video); // Update the selected video when a video is clicked
  };

  return (
    <div className="flex flex-col md:flex-row gap-10 h-full">
      <div className="flex-3 flex flex-col">
        {/* <div className="">Reelchoice</div> */}
        <h1 className="text-2xl font-bold mb-4">My Reels and Posters</h1>
        <h2 className="text-lg font-semibold">Scheduled videos and posters:</h2>
        <div className="w-full flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-xl p-4 m-4">
          <ul className="w-full flex gap-4 flex-wrap justify-evenly px-2 py-2">
            {mediaData.map((media) => (
              <li
                className="w-50 h-fit cursor-pointer  hover:border-blue-950 hover:bg-slate-50 rounded-xl border border-transparent *:rounded-xl"
                key={media.id}
                onClick={() => handleVideoClick(media)}
              >
                {media.type === "video" ? (
                  <video src={media.src} title={media.title} />
                ) : (
                  <img src={media.src} alt={media.title} title={media.title} />
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex-2">
        <h2 className="p-2 m-4 text-xl font-semibold">Current Reel/Poster:</h2>
        <div className="w-full h-auto p-2 m-4 flex justify-center items-center">
          {selectedVideo.type === "video" ? (
            <div className="rounded-lg overflow-hidden px-1 py-1">
              <video
                key={selectedVideo.id}
                className="w-60 rounded-xl"
                src={selectedVideo.src}
                title={selectedVideo.title}
                controls
              />
            </div>
          ) : (
            <img
              src={selectedVideo.src}
              alt={selectedVideo.title}
              title={selectedVideo.title}
              className="w-45 px-1 py-1 rounded-lg"
            />
          )}
        </div>
        <label className="inline-flex items-center cursor-pointer p-2 m-4 w-full">
          <span className="ml-3 text-sm font-medium text-gray-900 w-8/10">
            Use default Reels
          </span>
          <input
            type="checkbox"
            className="sr-only"
            checked={isToggled1}
            onChange={() => setIsToggled1(!isToggled1)}
          />
          <div
            className={`relative inline-block w-10 h-6 transition duration-200 ease-in-out rounded-full ${
              isToggled1 ? "bg-blue-950" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out ${
                isToggled1 ? "translate-x-4" : "translate-x-0"
              }`}
            ></span>
          </div>
        </label>
        <label className="inline-flex items-center cursor-pointer p-2 m-4 w-full">
          <span className="ml-3 text-sm font-medium text-gray-900 w-8/10">
            Use default Configuration
          </span>
          <input
            type="checkbox"
            className="sr-only"
            checked={isToggled2}
            onChange={() => setIsToggled2(!isToggled2)}
          />
          <div
            className={`relative inline-block w-10 h-6 transition duration-200 ease-in-out rounded-full ${
              isToggled2 ? "bg-blue-950" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out ${
                isToggled2 ? "translate-x-4" : "translate-x-0"
              }`}
            ></span>
          </div>
        </label>
      </div>
    </div>
  );
}

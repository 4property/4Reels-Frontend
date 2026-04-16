import React,{ useState } from "react";
import Button from "../utils/Button";

export default function ReelCustomisation() {
  const mediaData = [
    // Just placeholder video data, even if most of these things should be images. only used for the measurements and site-layout
    { src: "src/assets/video.mp4", title: "Video 1", id: 1, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 2", id: 2, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 3", id: 3, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 4", id: 4, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 5", id: 5, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 6", id: 6, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 7", id: 7, type: "video" },
  ];
  const audioData = [
    { src: "src/assets/video.mp4", title: "Video 1", id: 1, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 2", id: 2, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 3", id: 3, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 4", id: 4, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 5", id: 5, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 6", id: 6, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 7", id: 7, type: "video" },
  ];

  const [isToggled1, setIsToggled1] = useState(false);
  const [droppedItem, setDroppedItem] = useState(null);
  const [caption, setCaption] = React.useState("");
  const handleCaptionChange = (e) => {
    setCaption(e.target.value);
  }

  // started implementing drag and drop functionality, but stopped, because we need to connect to server for it to work, doesnt make sense to try doing it beforehand, as we would need to change it anyway when connecting to the server
  function handleDragOver(e) {
    e.preventDefault();
  }
  function handleDrop(e) {
    e.preventDefault();

    const item = Array.from(e.dataTransfer.files);
    setDroppedItem(item);
    // {item.type === "video/mp4" ? (mediaData.):()}
  }
  return (
    <div className="flex">
      <div className="flex flex-col gap-4 *:gap-4">
        <h1>Reel Customisation</h1>
        <div className=" flex">
          {/* The div for changing the order of the images */}
          <div className="w-full flex-2 p-2 flex border border-slate-200 rounded-xl">
            <div className="flex items-center">
              {mediaData.map((media, index) => (
                <div
                  key={media.id}
                  className={`rounded-xl cursor-pointer overflow-hidden hover:z-100 hover:duration-200 hover:scale-105 ${index !== 0 ? "-ml-40" : ""}`}
                  // style={{ zIndex: index }}
                >
                  <video src={media.src} className=" object-cover" />
                </div>
              ))}
            </div>
          </div>
          <div className="w-full flex-1 p-2 flex border border-slate-200 rounded-xl" onDragOver={handleDragOver} onDrop={handleDrop}>
            test
          </div>
          {/* The div for the media player */}
        </div>
        <div className="flex">
          <div className="w-full flex-2 p-2 flex flex-col items-center border border-slate-200 rounded-xl">
            <h2 className="w-full">Select Music for the Video</h2>
            <div className="w-full max-h-50 overflow-y-auto border:hidden">
              <ul className="w-full h-auto flex gap-2 flex-col justify-center px-2 py-2">
                {audioData.map((media) => (
                  <li className="w-full">
                    <audio controls className="w-full">
                      <source
                        src={media.src}
                        title={media.title}
                        type="audio/mpeg"
                      />
                      Your browser does not support the audio element.
                    </audio>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="w-full p-2 flex flex-1 border border-slate-200 rounded-xl">
            test2
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 *:gap-4">
        <div className=" h-3/5 p-2 ml-4 mt-10 flex flex-col border border-slate-200 rounded-xl">
          <h2 className="ml-4">Change Captions:</h2>
          <div className="w-full h-full flex border border-slate-200 rounded-xl">
            <textarea
              value={caption}
              onChange={handleCaptionChange}
              disabled={isToggled1}
              placeholder={isToggled1 ? "Speech-to-text is active" : "Enter caption here..."}
              className="w-full h-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-950 disabled:bg-gray-100"
            />
          </div>
        </div>
        <label className="inline-flex items-center cursor-pointer p-2 m-4 min-w-60">
          <span className="ml-3 text-sm font-medium text-gray-900 w-8/10">
            disable default caption and use speech-to-text
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
        <div className="ml-4 mt-6 flex justify-center">
          <Button>
            Set default Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}

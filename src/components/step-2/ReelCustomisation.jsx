import React, { useState } from "react";
import Button from "../utils/Button";
import { FaBookmark } from "react-icons/fa";
import { GoPlusCircle } from "react-icons/go";

export default function ReelCustomisation() {
  const [mediaData, setMediaData] = useState([
    // Just placeholder video data, even if most of these things should be images. only used for the measurements and site-layout
    { src: "src/assets/video.mp4", title: "Video 1", id: 1, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 2", id: 2, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 3", id: 3, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 4", id: 4, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 5", id: 5, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 6", id: 6, type: "video" },
    { src: "src/assets/video.mp4", title: "Video 7", id: 7, type: "video" },
  ]);
  const [audioData, setAudioData] = useState([
    {
      src: "src/assets/artmylife-powerful-dramatic-trailer-514242.mp3",
      title: "Audio 1",
      id: 1,
      type: "audio",
    },
    {
      src: "src/assets/artmylife-powerful-dramatic-trailer-514242.mp3",
      title: "Audio 2",
      id: 2,
      type: "audio",
    },
    {
      src: "src/assets/artmylife-powerful-dramatic-trailer-514242.mp3",
      title: "Audio 3",
      id: 3,
      type: "audio",
    },
    {
      src: "src/assets/artmylife-powerful-dramatic-trailer-514242.mp3",
      title: "Audio 4",
      id: 4,
      type: "audio",
    },
    {
      src: "src/assets/artmylife-powerful-dramatic-trailer-514242.mp3",
      title: "Audio 5",
      id: 5,
      type: "audio",
    },
    {
      src: "src/assets/artmylife-powerful-dramatic-trailer-514242.mp3",
      title: "Audio 6",
      id: 6,
      type: "audio",
    },
    {
      src: "src/assets/artmylife-powerful-dramatic-trailer-514242.mp3",
      title: "Audio 7",
      id: 7,
      type: "audio",
    },
  ]);

  const [isToggled1, setIsToggled1] = useState(false);
  const [caption, setCaption] = React.useState("");
  const handleCaptionChange = (e) => {
    setCaption(e.target.value);
  };

  // started implementing drag and drop functionality, but stopped, because we need to connect to server for it to work, doesnt make sense to try doing it beforehand, as we would need to change it anyway when connecting to the server
  function handleDragOver(e) {
    e.preventDefault();
  }
  function handleDropAudio(e) {
    e.preventDefault();

    const item = Array.from(e.dataTransfer.files);
    // setDroppedItem(item);
    item.forEach((file) => {
      if (file.type.startsWith("audio/")) {
        const newAudioItem = {
          src: URL.createObjectURL(file),
          title: file.name,
          id: audioData.length + 1,
          type: "audio",
        };
        setAudioData((prev) => [newAudioItem, ...prev]);
      }
    });
  }
  function handleDropMedia(e) {
    e.preventDefault();

    const item = Array.from(e.dataTransfer.files);
    // setDroppedItem(item);
    item.forEach((file) => {
      if (file.type.startsWith("video/") || file.type.startsWith("image/")) {
        const newMediaItem = {
          src: URL.createObjectURL(file),
          title: file.name,
          id: mediaData.length + 1,
          type: file.type.startsWith("video/") ? "video" : "image",
        };
        setMediaData((prev) => [...prev, newMediaItem]);
      }
    });
  }
  const [draggedIndex, setDraggedIndex] = useState(null);
  function handleDragStart(e, index) {
    setDraggedIndex(index);

    const dragPreview = document.createElement("div");
    dragPreview.textContent = mediaData[index].title;
    dragPreview.style.backgroundColor = "rgba(255, 255, 255, 0.7)";
    dragPreview.style.width = "80px";
    dragPreview.style.height = "120px";
    dragPreview.style.display = "flex";
    dragPreview.style.alignItems = "center";
    dragPreview.style.justifyContent = "center";
    dragPreview.style.border = "1px solid #ccc";
    dragPreview.style.borderRadius = "8px";
    dragPreview.style.fontSize = "14px";

    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 60, 90);

    requestAnimationFrame(() => {
      document.body.removeChild(dragPreview);
    });
  }

  function handleDropOnItem(dropIndex) {
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    setMediaData((prev) => {
      const updated = [...prev];
      const [movedItem] = updated.splice(draggedIndex, 1);
      updated.splice(dropIndex, 0, movedItem);
      return updated;
    });

    setDraggedIndex(null);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
  }

  const [selectedAudio, setSelectedAudio] = useState(null);
  function handleClickAudio(audio) {
    setSelectedAudio(audio);
    // alert(`Selected audio: ${audio.title}`);
  }

  return (
    <div className="flex">
      <div className="flex flex-col gap-4 *:gap-4">
        <h1 className="text-2xl font-bold mb-4">Reel Customisation</h1>
        <div className=" flex">
          {/* The div for changing the order of the images */}
          <div className="w-full flex-2 p-2 flex border border-slate-200 rounded-xl">
            <div className="flex items-center">
              {mediaData.map((media, index) => (
                <div
                  key={media.id}
                  className={`rounded-xl cursor-pointer overflow-hidden hover:z-100 hover:duration-200 hover:scale-105 ${index !== 0 ? "-ml-40" : ""}`}
                  // style={{ zIndex: index }}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDropOnItem(index)}
                  onDragEnd={handleDragEnd}
                  draggable
                >
                  <video
                    src={media.src}
                    title={media.title}
                    className=" object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
          <div
            className="w-full p-2 flex flex-1 flex-col items-center border border-slate-200 rounded-xl"
            onDragOver={handleDragOver}
            onDrop={handleDropMedia}
          >
            <p className="flex h-full items-center">
              Upload your own Images or Videos
            </p>
            <span className="flex flex-col h-full items-center gap-2">
              <GoPlusCircle />
            </span>
          </div>
          {/* The div for the audio player */}
        </div>
        <div className="flex">
          <div className="w-full flex-2 p-2 flex flex-col items-center border border-slate-200 rounded-xl">
            <h2 className="w-full">Select Music for the Video</h2>
            <div className="w-full max-h-50 overflow-y-auto border:hidden">
              <ul className="w-full h-auto flex gap-2 flex-col justify-center px-2 py-2">
                {audioData.map((media) => (
                  <li
                    className={`w-full hover:border-blue-950 hover:bg-slate-50 border rounded-lg ${selectedAudio?.id === media.id ? "border-blue-950 bg-slate-50" : "border-transparent"}`}
                    onClick={() => handleClickAudio(media)}
                  >
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
          <div
            className="w-full p-2 flex flex-1 flex-col items-center border border-slate-200 rounded-xl"
            onDragOver={handleDragOver}
            onDrop={handleDropAudio}
          >
            <p className="flex h-full items-center">Upload your Music</p>
            <span className="flex flex-col h-full items-center gap-2">
              <GoPlusCircle />
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 *:gap-4">
        <div className=" h-3/5 p-2 ml-4 mt-10 flex flex-col border border-slate-200 rounded-xl">
          <h2 className="ml-4">Change Captions:</h2>
          <div className="w-full h-full flex border border-slate-200 rounded-xl">
            {isToggled1 ? (
              <p className="p-2 font-bold">
                Caption Disabled. Use the voiceover feature to generate matching
                captions to your spoken voiceover.
              </p>
            ) : (
              <textarea
                value={caption}
                onChange={handleCaptionChange}
                disabled={isToggled1}
                placeholder={
                  isToggled1
                    ? "Speech-to-text is active"
                    : "Enter caption here..."
                }
                className="w-full h-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-950 disabled:bg-gray-100"
              />
            )}
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
                isToggled1 ? "translate-x-3" : "translate-x-0"
              }`}
            ></span>
          </div>
        </label>
        <div className="ml-4 mt-6 flex justify-center">
          <Button>
            <span className="flex items-center gap-2">
              <p>Set default Configuration</p>
              <FaBookmark className="ml-2" />
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

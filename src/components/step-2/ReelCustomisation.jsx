import React from "react";

export default function ReelCustomisation() {
  const mediaData = [
    // Just placeholder video data, even if most of these things should be images. only used for the measurements and site-layout
    {src: "src/assets/video.mp4", title: "Video 1", id: 1, type: "video"},
    {src: "src/assets/video.mp4", title: "Video 2", id: 2, type: "video"},
    {src: "src/assets/video.mp4", title: "Video 3", id: 3, type: "video"},
    {src: "src/assets/video.mp4", title: "Video 4", id: 4, type: "video"},
    {src: "src/assets/video.mp4", title: "Video 5", id: 5, type: "video"},
  ]
  return (
    <div className="flex">
      <div className="flex-1">
        <h1>Reel Customisation</h1>
        <div className="w-full max-h-140 p-2 m-4 flex items-center border border-slate-200 rounded-xl">
          <div className="grid place-items-center w-[520px] h-[320px] rounded-xl border border-slate-200 overflow-hidden">
  {mediaData.map((media, index) => (
    <div
      key={media.id}
      className="col-start-1 row-start-1 w-full h-full rounded-xl overflow-hidden shadow-lg"
      style={{
        transform: `translate(${index * 18}px)`,
        zIndex: index,
      }}
    >
      <video src={media.src} className="w-full h-full object-cover" />
    </div>
  ))}
</div>

        </div>
      </div>
      <div className="flex-1">
        <h2>Preview</h2>
        <div className="w-full h-full p-2 m-4 border border-slate-200 rounded-xl">
          <p>Preview area</p>
        </div>
      </div>
    </div>

  );
}

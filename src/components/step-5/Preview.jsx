import React from "react";
import videoFile from "../../assets/video.mp4";
import Button from "../utils/Button";

export default function Preview() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Preview</h1>
      <div className="h-full flex  items-center justify-evenly">
        <div className="w-100">
          <video src={videoFile} controls className="rounded-xl" />
        </div>
        <div className="w-100 h-auto rounded-xl bg-gray-200 flex flex-col items-center justify-center">
          <p className="text-gray-500">Preview Area</p>
          <Button>Upload now</Button>
          <Button>Schedule upload</Button>
        </div>
      </div>
    </div>
  );
}

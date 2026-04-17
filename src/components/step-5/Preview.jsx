import React from "react";
import videoFile from "../../assets/video.mp4";
import Button from "../utils/Button";
import { MdOutlineFileUpload } from "react-icons/md";
import { FiClock } from "react-icons/fi";

export default function Preview() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Preview</h1>
      <div className="h-full flex items-center justify-evenly">
        <div className="w-100">
          <video src={videoFile} controls className="rounded-xl" />
        </div>
        <div className="flex flex-col items-end justify-center gap-4">
          <div className="w-100 h-auto rounded-xl bg-gray-200 flex flex-col items-center justify-center">
            <p className="text-gray-500 flex">Preview Area</p>
          </div>
          <Button >
              <span className="flex items-center gap-2">
                Upload now
                <MdOutlineFileUpload />
              </span>
          </Button>
          <Button >
            <span className="flex items-center gap-2">
              <p >Schedule upload</p>
              <FiClock />
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import videoFile from "../../assets/video.mp4";
import Button from "../utils/Button";
import { MdOutlineFileUpload } from "react-icons/md";
import { FiClock } from "react-icons/fi";

export default function Preview({ goToStep, reviewSteps }) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Preview</h1>
      <div className="h-full flex items-center justify-evenly">
        <div className="w-100">
          <video src={videoFile} controls className="rounded-xl" />
        </div>
        <div className="flex flex-col items-end justify-center gap-4">
          <div className="w-full h-auto rounded bg-gray-200 flex flex-col items-center justify-center">
            <p className="text-gray-500 flex">Preview Area</p>
            {reviewSteps.map((step) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center justify-between w-full p-4 gap-4">
                  <p className="flex flex-1 bg-white p-2 gap-2 rounded">
                    {step.title}
                  </p>
                  <Button className="flex" onClick={() => goToStep(step.id)}>
                    {step.buttonLabel}
                  </Button>
                </div>
                <p className="mr-auto p-2">(Test) 3</p>
              </React.Fragment>
            ))}
          </div>
          <Button>
            <span className="w-50 flex items-center justify-between gap-2">
              Upload now
              <MdOutlineFileUpload />
            </span>
          </Button>
          <Button>
            <span className=" w-50 flex items-center justify-between gap-2">
              <p>Schedule upload</p>
              <FiClock />
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { StepInformation } from "./StepInformation";

function getStepStatus(index, currentStep) {
  if (index < currentStep) return "completed";
  if (index === currentStep) return "active";
  return "pending";
}

function getLineStatus(index, currentStep) {
  return index < currentStep ? "completed" : "pending";
}

function Navbar({ currentStep, onNext, onPrevious, stepNumber }) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === stepNumber - 1;

  return (
    <nav className="flex gap-6 justify-between items-center">
      <div className="flex items-center">
        {Array.from({ length: stepNumber }, (_, i) => (
          <React.Fragment key={i}>
            <StepInformation
              stepIndex={i}
              status={getStepStatus(i, currentStep)}
            />

            {i < stepNumber - 1 && (
              <div
                className={`h-1 w-10 transition-colors ${
                  getLineStatus(i, currentStep) === "completed"
                    ? "bg-blue-950"
                    : "bg-gray-300"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onPrevious}
          disabled={isFirstStep}
          className="rounded-full bg-blue-950 px-10 py-2 text-white transition-opacity cursor-pointer disabled:cursor-auto disabled:opacity-50"
        >
          Previous
        </button>

        <button
          onClick={onNext}
          disabled={isLastStep}
          className="rounded-full bg-blue-950 px-10 py-2 text-white transition-opacity cursor-pointer disabled:cursor-auto disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </nav>
  );
}

export { Navbar };

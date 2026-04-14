import React from "react";
import { StepInformation } from "./StepInformation";
function Navbar({ currentStep, onNext, onPrevious, stepNumber }) {
  function getStepStatus(index, currentStep) {
    if (index < currentStep) return "completed";
    if (index === currentStep) return "active";
    return "pending";
  }

  return (
    <nav>
      <div className="flex items-center  mb-4">
        {/* Step Information stepNumber times */}
        {Array.from({ length: stepNumber }, (_, i) => (
          <React.Fragment key={i}>
            <StepInformation
              currentStep={i}
              status={getStepStatus(i, currentStep)}
            />
            {i < stepNumber - 1 && <div className="w-10 h-1 bg-blue-950" />}
          </React.Fragment>
        ))}
      </div>
      <div className="*:rounded-full *:bg-blue-950 *:text-white *:px-4 *:py-2 *:cursor-pointer disabled:*:opacity-50 disabled:*:cursor-not-allowed flex">
        <button onClick={onPrevious}>Previous</button>
        <button onClick={onNext}>Next</button>
      </div>
    </nav>
  );
}

export { Navbar };

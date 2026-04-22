import React from "react";
import { StepInformation } from "./StepInformation";

function getStepStatus(index, currentStep, skippedSteps) {
  if (index === currentStep) return "active";
  if (skippedSteps && skippedSteps.includes(index)) return "skipped";
  if (index < currentStep) return "completed";
  return "pending";
}

function getLineStatus(index, currentStep, skippedSteps) {
  const nextStepIndex = index + 1;

  if (skippedSteps?.includes(nextStepIndex)) return "skipped";
  if (nextStepIndex <= currentStep) return "completed";
  return "pending";
}

function Navbar({ currentStep, onNext, onPrevious, stepNumber, skippedSteps }) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === stepNumber - 1;

  return (
    <nav className="flex flex-col gap-4 rounded-2xl  bg-white px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center">
          {Array.from({ length: stepNumber }, (_, i) => (
            <React.Fragment key={i}>
              <StepInformation
                stepIndex={i}
                status={getStepStatus(i, currentStep, skippedSteps)}
              />

              {i < stepNumber - 1 && (
                <div
                  className={`h-0.5 w-10 rounded-full transition-colors ${
                    getLineStatus(i, currentStep, skippedSteps) === "completed"
                      ? "bg-blue-950"
                      : getLineStatus(i, currentStep, skippedSteps) ===
                          "skipped"
                        ? "bg-slate-300"
                        : "bg-slate-200"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onPrevious}
          disabled={isFirstStep}
          className="cursor-pointer rounded-full border-2 border-slate-300 bg-white px-6 py-2 text-slate-700 transition-colors hover:border-slate-400 disabled:cursor-auto disabled:opacity-50"
        >
          Previous
        </button>

        <button
          onClick={onNext}
          disabled={isLastStep}
          className="cursor-pointer rounded-full bg-blue-950 px-6 py-2 text-white transition-opacity disabled:cursor-auto disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </nav>
  );
}

export { Navbar };

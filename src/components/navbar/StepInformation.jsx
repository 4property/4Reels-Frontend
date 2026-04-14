import React from "react";

export function StepInformation({ currentStep, status }) {
  const baseClassName =
    "w-14 h-14 flex items-center justify-center rounded-full border-4 font-bold";

  const statusClasses = {
    completed: "bg-white border-blue-950 text-blue-950",
    active: "bg-blue-950 border-blue-950 text-white",
    pending: "bg-white border-blue-950 text-blue-950",
  };

  return (
    <div className={`${baseClassName} ${statusClasses[status]}`}>
      {currentStep + 1}
    </div>
  );
}

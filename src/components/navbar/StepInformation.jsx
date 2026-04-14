import React from "react";

function StepInformation({ stepIndex, status }) {
  const baseClasses =
    "w-14 h-14 flex items-center justify-center rounded-full border-4 font-bold transition-colors";

  const statusClasses = {
    completed: "bg-blue-950 border-blue-950 text-white",
    active: "bg-white border-blue-950 text-blue-950",
    pending: "bg-transparent border-gray-300 text-gray-400",
  };

  return (
    <div className={`${baseClasses} ${statusClasses[status]}`}>
      {stepIndex + 1}
    </div>
  );
}

export { StepInformation };

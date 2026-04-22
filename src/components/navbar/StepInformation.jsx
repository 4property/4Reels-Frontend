import React from "react";

function StepInformation({ stepIndex, status }) {
  const baseClasses =
    "flex h-15 w-15 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors";

  const statusClasses = {
    completed: "border-blue-950 bg-white text-blue-950",
    active: "border-blue-950 bg-blue-950 text-white",
    pending: "border-slate-300 bg-white text-slate-500",
    skipped: "border-dashed border-slate-300 bg-slate-100 text-slate-400",
  };

  return (
    <div className="flex min-w-14 flex-col items-center gap-1">
      <div className={`${baseClasses} ${statusClasses[status]}`}>
        {stepIndex + 1}
      </div>
    </div>
  );
}

export { StepInformation };

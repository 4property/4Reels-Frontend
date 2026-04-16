import "./App.css";
import { Navbar } from "./components/navbar/Navbar";
import ReelChoice from "./components/step-1/ReelChoice";
import ReelCustomisation from "./components/step-2/ReelCustomisation";
import ReelRecorder from "./components/step-3/ReelRecorder";
import SocialEditPage from "./components/step-4/SocialEditPage";

import { useState } from "react";

function App() {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    <ReelChoice />,
    <ReelCustomisation />,
    <ReelRecorder />,
    <SocialEditPage />,
  ];

  const goToNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="p-5 h-screen flex flex-col gap-10">
      <Navbar
        currentStep={currentStep}
        onNext={goToNextStep}
        onPrevious={goToPreviousStep}
        stepNumber={steps.length}
      />
      <div className="flex-1 min-h-0">{steps[currentStep]}</div>
    </div>
  );
}

export default App;

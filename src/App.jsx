import "./App.css";
import { Navbar } from "./components/navbar/Navbar";
import ReelChoice from "./components/step-1/ReelChoice";
import ReelCustomisation from "./components/step-2/ReelCustomisation";
import ReelRecorder from "./components/step-3/ReelRecorder";
import SocialEditPage from "./components/step-4/SocialEditPage";

import { useState } from "react";

function App() {
  const [currentStep, setCurrentStep] = useState(0);

  //functionality of the use default reel toggle switch, if you have a better idea where to put it change it
  const [isToggledDefaultReel, setIsToggledDefaultReel] = useState(false);


  const goToStep = (stepIndex) => {
    setCurrentStep(stepIndex);
  };

  const skippedSteps = isToggledDefaultReel ? [0, 1, 2] : [];

  const steps = [
    <ReelChoice isToggledDefaultReel={isToggledDefaultReel} setIsToggledDefaultReel={setIsToggledDefaultReel} />,
    <ReelCustomisation />,
    <ReelRecorder />,
    <SocialEditPage />,
  ];

  const goToNextStep = () => {
     //Logic for skipping steps 1-4 if the default reel toggle is on, but as step 5 is doesn't exist on this branch, it hast o be commented out for the moment
     if(isToggledDefaultReel){
       setCurrentStep(3);
       return
     }
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
     if(isToggledDefaultReel){
       setCurrentStep(0);
       return
     }
    
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
        skippedSteps={skippedSteps}
      />
      <div className="flex-1 min-h-0">{steps[currentStep]}</div>
    </div>
  );
}

export default App;

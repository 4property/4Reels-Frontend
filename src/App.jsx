import "./App.css";
import { Navbar } from "./components/navbar/Navbar";
import ReelChoice from "./components/step-1/ReelChoice";
import ReelCustomisation from "./components/step-2/ReelCustomisation";
import ReelRecorder from "./components/step-3/ReelRecorder";
import SocialEditPage from "./components/step-4/SocialEditPage";

import { useEffect, useMemo, useState } from "react";
import Preview from "./components/step-5/Preview";

function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isToggledDefaultReel, setIsToggledDefaultReel] = useState(false);

  const steps = useMemo(
    () => [
      {
        id: "reel-choice",
        element: (
          <ReelChoice
            isToggledDefaultReel={isToggledDefaultReel}
            setIsToggledDefaultReel={setIsToggledDefaultReel}
          />
        ),
      },
      {
        id: "reel-customisation",
        element: <ReelCustomisation />,
        isSkipped: isToggledDefaultReel,
        reviewTitle: "Reel Customization Changes",
        reviewButtonLabel: "Go back to Customization Page",
      },
      {
        id: "reel-recorder",
        element: <ReelRecorder />,
        isSkipped: isToggledDefaultReel,
        reviewTitle: "Voice-Over Changes",
        reviewButtonLabel: "Go back to Voice-Over Page",
      },
      {
        id: "social-edit",
        element: <SocialEditPage />,
        reviewTitle: "Social Changes",
        reviewButtonLabel: "Go back to Social Page",
      },
      {
        id: "preview",
        element: null,
      },
    ],
    [isToggledDefaultReel]
  );

  const skippedSteps = useMemo(
    () =>
      steps.reduce((indexes, step, index) => {
        if (step.isSkipped) {
          indexes.push(index);
        }

        return indexes;
      }, []),
    [steps]
  );

  const findNextAvailableStep = (fromIndex) => {
    for (let index = fromIndex + 1; index < steps.length; index += 1) {
      if (!steps[index].isSkipped) {
        return index;
      }
    }

    return fromIndex;
  };

  const findPreviousAvailableStep = (fromIndex) => {
    for (let index = fromIndex - 1; index >= 0; index -= 1) {
      if (!steps[index].isSkipped) {
        return index;
      }
    }

    return fromIndex;
  };

  const getStepIndex = (stepId) =>
    steps.findIndex((step) => step.id === stepId);

  const goToStep = (stepIndex) => {
    if (stepIndex < 0 || stepIndex >= steps.length || steps[stepIndex].isSkipped) {
      return;
    }

    setCurrentStep(stepIndex);
  };

  const goToStepById = (stepId) => {
    const stepIndex = getStepIndex(stepId);
    goToStep(stepIndex);
  };

  const reviewSteps = useMemo(
    () =>
      steps
        .filter((step) => step.reviewTitle && !step.isSkipped)
        .map((step) => ({
          id: step.id,
          title: step.reviewTitle,
          buttonLabel: step.reviewButtonLabel,
        })),
    [steps]
  );

  const currentStepContent =
    steps[currentStep].id === "preview" ? (
      <Preview goToStep={goToStepById} reviewSteps={reviewSteps} />
    ) : (
      steps[currentStep].element
    );

  useEffect(() => {
    if (steps[currentStep]?.isSkipped) {
      const nextStepIndex = findNextAvailableStep(currentStep);

      if (nextStepIndex !== currentStep) {
        setCurrentStep(nextStepIndex);
        return;
      }

      const previousStepIndex = findPreviousAvailableStep(currentStep);

      if (previousStepIndex !== currentStep) {
        setCurrentStep(previousStepIndex);
      }
    }
  }, [currentStep, steps]);

  const goToNextStep = () => {
    const nextStepIndex = findNextAvailableStep(currentStep);

    if (nextStepIndex !== currentStep) {
      setCurrentStep(nextStepIndex);
    }
  };

  const goToPreviousStep = () => {
    const previousStepIndex = findPreviousAvailableStep(currentStep);

    if (previousStepIndex !== currentStep) {
      setCurrentStep(previousStepIndex);
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
      <div className="flex-1 min-h-0">{currentStepContent}</div>
    </div>
  );
}

export default App;

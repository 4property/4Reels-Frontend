import { useEffect, useRef } from "react";

const DEFAULT_VISUALIZER_SCALE = {
  barWidth: 16,
  maxHeight: 112,
  minHeight: 16,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getStatusCopy({ error, isPreparing, isRecording }) {
  if (error) {
    return error;
  }

  if (isPreparing) {
    return "Starting microphone...";
  }

  if (isRecording) {
    return "Recording live audio.";
  }

  return "Ready to record.";
}

function getCenteredFade(index, totalBars) {
  if (totalBars <= 1) {
    return 1;
  }

  const center = (totalBars - 1) / 2;
  const distanceFromCenter = Math.abs(index - center);
  const normalizedDistance = center === 0 ? 0 : distanceFromCenter / center;

  return 1 - normalizedDistance;
}

function getVisualizerBarStyle({ index, isActive, level, scale, totalBars }) {
  const centeredFade = getCenteredFade(index, totalBars);

  const restingHeight = scale.minHeight;
  const maxHeight = Math.max(scale.maxHeight, restingHeight);
  const safeLevel = clamp(level, 0, 1);

  const visibleHeight = restingHeight + (maxHeight - restingHeight) * safeLevel;
  const translateY = maxHeight - visibleHeight;

  const opacity = isActive ? 0.2 + safeLevel * 0.5 + centeredFade * 0.08 : 0.14;

  return {
    backgroundColor: `rgb(23 37 84 / ${opacity})`,
    transform: `translate3d(0, ${translateY}px, 0)`,
  };
}

export default function AudioRecorder({
  audioExtension,
  audioUrl,
  error,
  frequencyBarCount,
  frequencyBarsRef,
  isPreparing,
  isRecording,
  visualizerScale = DEFAULT_VISUALIZER_SCALE,
}) {
  const barRefs = useRef([]);
  const smoothedLevelsRef = useRef([]);
  const isVisualizerActive = isPreparing || isRecording;
  const statusCopy = getStatusCopy({ error, isPreparing, isRecording });

  useEffect(() => {
    barRefs.current = barRefs.current.slice(0, frequencyBarCount);
    smoothedLevelsRef.current = Array.from(
      { length: frequencyBarCount },
      (_, index) => smoothedLevelsRef.current[index] ?? 0,
    );

    const applyLevels = (levels, isActive) => {
      for (let index = 0; index < frequencyBarCount; index += 1) {
        const barElement = barRefs.current[index];

        if (!barElement) {
          continue;
        }

        const rawLevel = levels[index] ?? 0;
        const clampedLevel = clamp(rawLevel, 0, 1);

        const nextStyles = getVisualizerBarStyle({
          index,
          isActive,
          level: clampedLevel,
          scale: visualizerScale,
          totalBars: frequencyBarCount,
        });

        barElement.style.backgroundColor = nextStyles.backgroundColor;
        barElement.style.transform = nextStyles.transform;
      }
    };

    const resetLevels = () => {
      const zeroLevels = Array.from({ length: frequencyBarCount }, () => 0);
      smoothedLevelsRef.current = zeroLevels;
      applyLevels(zeroLevels, false);
    };

    if (!isVisualizerActive) {
      resetLevels();
      return;
    }

    let animationFrameId = 0;

    const updateBars = () => {
      const sourceLevels = frequencyBarsRef.current ?? [];
      const smoothedLevels = smoothedLevelsRef.current;

      for (let index = 0; index < frequencyBarCount; index += 1) {
        const nextLevel = clamp(sourceLevels[index] ?? 0, 0, 1);
        const previousLevel = smoothedLevels[index] ?? 0;

        // Plus la valeur est élevée, plus la réponse est rapide.
        smoothedLevels[index] =
          previousLevel + (nextLevel - previousLevel) * 0.22;
      }

      applyLevels(smoothedLevels, true);
      animationFrameId = window.requestAnimationFrame(updateBars);
    };

    updateBars();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [
    frequencyBarCount,
    frequencyBarsRef,
    isVisualizerActive,
    visualizerScale.barWidth,
    visualizerScale.maxHeight,
    visualizerScale.minHeight,
  ]);

  return (
    <section className="w-full rounded-[28px] border border-blue-950/10 bg-white p-6 shadow-[0_20px_60px_rgba(23,37,84,0.06)] sm:p-7">
      <div className="flex items-center gap-3">
        <div
          className={`h-3 w-3 rounded-full ${
            isPreparing
              ? "animate-pulse bg-amber-400"
              : isRecording
                ? "animate-pulse bg-blue-950"
                : "bg-blue-950/20"
          }`}
        />
        <p className={`text-sm ${error ? "text-red-600" : "text-blue-950/70"}`}>
          {statusCopy}
        </p>
      </div>

      <div
        className="mt-6 flex items-end justify-center gap-2 overflow-hidden rounded-[24px] bg-slate-50/80 px-4 py-5 sm:gap-3"
        style={{ minHeight: `${visualizerScale.maxHeight + 40}px` }}
      >
        {Array.from({ length: frequencyBarCount }, (_, index) => {
          const initialStyles = getVisualizerBarStyle({
            index,
            isActive: false,
            level: 0,
            scale: visualizerScale,
            totalBars: frequencyBarCount,
          });

          return (
            <div
              key={`frequency-bar-slot-${index}`}
              aria-hidden="true"
              className="relative overflow-hidden"
              style={{
                height: `${visualizerScale.maxHeight}px`,
                width: `${visualizerScale.barWidth}px`,
              }}
            >
              <div
                ref={(element) => {
                  barRefs.current[index] = element;
                }}
                className="absolute left-0 top-0 will-change-transform rounded-full"
                style={{
                  ...initialStyles,
                  height: `${visualizerScale.maxHeight + visualizerScale.barWidth}px`,
                  width: `${visualizerScale.barWidth}px`,
                  transformOrigin: "top center",
                }}
              />
            </div>
          );
        })}
      </div>

      {audioUrl && (
        <div className="mt-6 rounded-[22px] border border-blue-950/10 bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg text-blue-950">Recorded Audio</h2>
            <span className="rounded-full border border-blue-950/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-950/55">
              .{audioExtension}
            </span>
          </div>
          <audio
            className="mt-4 w-full accent-blue-950"
            controls
            preload="metadata"
            src={audioUrl}
          />
        </div>
      )}
    </section>
  );
}

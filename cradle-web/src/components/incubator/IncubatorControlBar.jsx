import { useEffect, useRef, useState } from "react";
import { CultivateButton } from "./CultivateButton";
import { DivideButton } from "./DivideButton";
import { FuseButton } from "./FuseButton";
import { ModelButton } from "./ModelButton";
import { ProviderButton } from "./ProviderButton";
import { StabilizeButton } from "./StabilizeButton";

const FALLBACK_PROVIDERS = [
  {
    id: "copilot",
    label: "Copilot",
    models: ["gpt-5.5", "gpt-5.6", "gpt-5-mini"],
  },
  {
    id: "ollama",
    label: "Ollama",
    models: ["devstral-small-2:24b", "gemma3:latest"],
  },
  {
    id: "gemini",
    label: "Gemini",
    models: ["auto", "gemini-2.5-pro", "gemini-2.5-flash"],
  },
];

export function IncubatorControlBar({
  aiSettings,
  isCultivating,
  message,
  error,
  cells,
  selectedCellId,
  activeCellOperation,
  isFuseMenuOpen,
  selectedFuseCellIds,
  onRunOneCycle,
  onChangeAiSettings,
  onOpenStabilize,
  onOpenDivide,
  onToggleFuseMenu,
  onToggleFuseCell,
  onCancelFuse,
  onContinueFuse,
  onCloseFuseMenu,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const dockRef = useRef(null);
  const providers = aiSettings?.options?.length
    ? aiSettings.options
    : FALLBACK_PROVIDERS;
  const selectedProvider = aiSettings?.current?.provider ?? providers[0]?.id;
  const selectedProviderOption =
    providers.find((provider) => provider.id === selectedProvider) ??
    providers[0];
  const selectedModel =
    aiSettings?.current?.model ??
    selectedProviderOption?.models?.[0] ??
    "";
  const models = selectedProviderOption?.models ?? [];
  const hasSelectedCell = Boolean(selectedCellId);
  const hasFuseTarget = cells.some((cell) => cell.id !== selectedCellId);
  const isOperationRunning = Boolean(activeCellOperation);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!dockRef.current?.contains(event.target)) {
        setOpenMenu(null);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function toggleMenu(menuId) {
    onCloseFuseMenu?.();
    setOpenMenu((current) => current === menuId ? null : menuId);
  }

  function handleSelectProvider(providerId) {
    const provider = providers.find((item) => item.id === providerId);
    const nextModel = provider?.models?.[0] ?? selectedModel;

    onChangeAiSettings?.({ provider: providerId, model: nextModel });
  }

  function handleSelectModel(model) {
    onChangeAiSettings?.({ provider: selectedProvider, model });
  }

  return (
    <div className="cradle-control-dock__viewport">
      <div ref={dockRef} className="cradle-control-dock incubator-control-bar">
        <div
          className="cradle-control-dock__group cradle-control-dock__group--settings"
          role="group"
          aria-label="AI settings"
        >
          <ProviderButton
            providers={providers}
            selectedProvider={selectedProvider}
            isOpen={openMenu === "provider"}
            onToggle={() => toggleMenu("provider")}
            onClose={() => setOpenMenu(null)}
            onSelect={handleSelectProvider}
          />
          <ModelButton
            models={models}
            selectedModel={selectedModel}
            isOpen={openMenu === "model"}
            onToggle={() => toggleMenu("model")}
            onClose={() => setOpenMenu(null)}
            onSelect={handleSelectModel}
          />
        </div>

        <CultivateButton isRunning={isCultivating} onClick={onRunOneCycle} />

        <div
          className="cradle-control-dock__group cradle-control-dock__group--cell-actions"
          role="group"
          aria-label="Cell operations"
        >
          <StabilizeButton
            disabled={!hasSelectedCell || isOperationRunning}
            isRunning={activeCellOperation === "stabilize"}
            title={!hasSelectedCell ? "Select a cell first" : "Stabilize selected Cell"}
            onClick={onOpenStabilize}
          />
          <DivideButton
            disabled={!hasSelectedCell || isOperationRunning}
            isRunning={activeCellOperation === "divide"}
            title={!hasSelectedCell ? "Select a cell first" : "Divide selected Cell"}
            onClick={onOpenDivide}
          />
          <FuseButton
            cells={cells}
            selectedCellId={selectedCellId}
            selectedCellIds={selectedFuseCellIds}
            disabled={!hasSelectedCell || !hasFuseTarget || isOperationRunning}
            isRunning={activeCellOperation === "fuse"}
            isOpen={isFuseMenuOpen}
            title={
              !hasSelectedCell
                ? "Select a cell first"
                : !hasFuseTarget
                  ? "At least two cells are required"
                  : "Fuse selected Cell with other Cells"
            }
            onToggle={() => {
              setOpenMenu(null);
              onToggleFuseMenu();
            }}
            onToggleCell={onToggleFuseCell}
            onCancel={onCancelFuse}
            onContinue={onContinueFuse}
            onClose={onCloseFuseMenu}
          />
        </div>

        <div
          className={`cradle-dock-feedback${error ? " is-error" : ""}`}
          aria-live="polite"
        >
          {error || message}
        </div>
      </div>
    </div>
  );
}

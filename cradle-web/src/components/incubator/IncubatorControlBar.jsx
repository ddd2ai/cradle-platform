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
    label: "OpenAI",
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
  onRunOneCycle,
  onChangeAiSettings,
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

        <CultivateButton isRunning={isCultivating} onClick={onRunOneCycle} />

        <StabilizeButton />
        <DivideButton />
        <FuseButton />

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

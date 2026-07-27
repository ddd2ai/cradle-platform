import { DockMenu } from "./DockMenu";

export function ModelButton({
  models,
  selectedModel,
  isOpen,
  onToggle,
  onClose,
  onSelect,
}) {
  return (
    <DockMenu
      id="model"
      icon="⌬"
      label={selectedModel || "Model"}
      items={models.map((model) => ({
        label: model,
        meta: model === selectedModel ? "Current" : null,
        onSelect: () => onSelect?.(model),
      }))}
      isOpen={isOpen}
      onToggle={onToggle}
      onClose={onClose}
    />
  );
}

import { DockMenu } from "./DockMenu";
import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

export function ModelButton({
  models,
  selectedModel,
  isOpen,
  onToggle,
  onClose,
  onSelect,
}) {
  const { t } = useUiPreferences();
  return (
    <DockMenu
      id="model"
      icon="⌬"
      label={selectedModel || t("settings.defaultModel")}
      items={models.map((model) => ({
        label: model,
        meta: model === selectedModel ? t("common.current") : null,
        onSelect: () => onSelect?.(model),
      }))}
      isOpen={isOpen}
      onToggle={onToggle}
      onClose={onClose}
    />
  );
}

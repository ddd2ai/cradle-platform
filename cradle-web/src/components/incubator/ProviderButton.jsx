import { DockMenu } from "./DockMenu";
import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

export function ProviderButton({
  providers,
  selectedProvider,
  isOpen,
  onToggle,
  onClose,
  onSelect,
}) {
  const { t } = useUiPreferences();
  const providerLabel =
    providers.find((provider) => provider.id === selectedProvider)?.label ??
    t("settings.providers");

  return (
    <DockMenu
      id="provider"
      icon="◌"
      label={providerLabel}
      items={providers.map((provider) => ({
        label: provider.label,
        meta: provider.id === selectedProvider ? t("common.current") : null,
        onSelect: () => onSelect?.(provider.id),
      }))}
      isOpen={isOpen}
      onToggle={onToggle}
      onClose={onClose}
    />
  );
}

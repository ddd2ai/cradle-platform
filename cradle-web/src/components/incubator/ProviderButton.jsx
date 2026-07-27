import { DockMenu } from "./DockMenu";

export function ProviderButton({
  providers,
  selectedProvider,
  isOpen,
  onToggle,
  onClose,
  onSelect,
}) {
  const providerLabel =
    providers.find((provider) => provider.id === selectedProvider)?.label ??
    "Provider";

  return (
    <DockMenu
      id="provider"
      icon="◌"
      label={providerLabel}
      items={providers.map((provider) => ({
        label: provider.label,
        meta: provider.id === selectedProvider ? "Current" : null,
        onSelect: () => onSelect?.(provider.id),
      }))}
      isOpen={isOpen}
      onToggle={onToggle}
      onClose={onClose}
    />
  );
}

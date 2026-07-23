interface PortalBrandProps {
  compactLabel?: string;
}

export function PortalBrand({ compactLabel }: PortalBrandProps) {
  return (
    <div className="portal-brand" aria-label="Vestibulando Preparatório">
      <span className="portal-brand-letter" aria-hidden="true">V</span>
      <span className="portal-brand-name">Vestibulando</span>
      {compactLabel && <span className="portal-brand-context">{compactLabel}</span>}
    </div>
  );
}

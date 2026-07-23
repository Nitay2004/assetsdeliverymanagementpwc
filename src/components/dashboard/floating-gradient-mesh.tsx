export function BackgroundGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="grid-panel-top-left" />
      <div className="grid-panel-bottom-right" />
    </div>
  );
}

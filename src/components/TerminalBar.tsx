import { TerminalPanel } from './TerminalPanel';

interface TerminalBarProps {
  isOpen: boolean;
  height: number;
  onStartResize: () => void;
}

export function TerminalBar({ isOpen, height, onStartResize }: TerminalBarProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="resize-handle-horizontal"
        onMouseDown={onStartResize}
        style={{ height: 4, cursor: 'row-resize', background: '#333', flexShrink: 0 }}
      />
      <div style={{ height, position: 'relative', flexShrink: 0 }}>
        <TerminalPanel isOpen={isOpen} height="100%" />
      </div>
    </>
  );
}

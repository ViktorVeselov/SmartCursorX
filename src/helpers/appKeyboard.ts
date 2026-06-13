import { useEffect } from 'react';

export function useKeyboardShortcuts(
  handleSaveRef: React.MutableRefObject<() => Promise<void>>
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveRef]);
}

export function useResizeHandlers(
  sidebarResizing: React.MutableRefObject<boolean>,
  terminalResizing: React.MutableRefObject<boolean>,
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>,
  setTerminalHeight: React.Dispatch<React.SetStateAction<number>>
) {
  useEffect(() => {
    const handleMouseUp = () => {
      sidebarResizing.current = false;
      terminalResizing.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (sidebarResizing.current) {
        setSidebarWidth(Math.max(100, Math.min(1400, e.clientX)));
      }
      if (terminalResizing.current) {
        const newHeight = window.innerHeight - e.clientY;
        setTerminalHeight(Math.max(50, Math.min(window.innerHeight - 100, newHeight)));
      }
    };
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [sidebarResizing, terminalResizing, setSidebarWidth, setTerminalHeight]);
}

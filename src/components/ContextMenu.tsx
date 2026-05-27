import { useEffect, useRef } from 'react';

export interface MenuItem {
    label: string;
    action: () => void;
    shortcut?: string;
    danger?: boolean;
    separator?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: MenuItem[];
    onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        // Prevent menu from going off-screen
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                menuRef.current.style.left = `${window.innerWidth - rect.width - 5}px`;
            }
            if (rect.bottom > window.innerHeight) {
                menuRef.current.style.top = `${window.innerHeight - rect.height - 5}px`;
            }
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="context-menu"
            style={{ top: y, left: x }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
        >
            {items.map((item, index) => (
                item.separator ? (
                    <div key={index} className="context-menu-separator" />
                ) : (
                    <button
                        key={index}
                        className={`context-menu-item ${item.danger ? 'danger' : ''}`}
                        onClick={() => {
                            item.action();
                            onClose();
                        }}
                    >
                        <span className="label">{item.label}</span>
                        {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
                    </button>
                )
            ))}
        </div>
    );
}

import React from 'react';

import WidgetIconButton from './WidgetIconButton';

interface WidgetHeaderProps {
    isExpanded: boolean;
    dragging: boolean;
    onMouseDown?: (e: React.MouseEvent) => void;
    onExpandToggle: () => void;
    onClose: () => void;
}

const WidgetHeader: React.FC<WidgetHeaderProps> = ({
    isExpanded,
    dragging,
    onMouseDown,
    onExpandToggle,
    onClose,
}) => {
    return (
        <div
            className='daakia-call-widget-header'
            onMouseDown={onMouseDown}
            style={{
                cursor: dragging ? 'grabbing' : 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                height: '60px',
                borderBottom: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
            }}
        >
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <i
                    className='icon icon-phone'
                    style={{fontSize: '16px', color: 'rgb(var(--button-bg-rgb))'}}
                />
                <span style={{fontSize: '14px', fontWeight: 600}}>
                    {'Call'}
                </span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <WidgetIconButton
                    iconClassName={`icon ${isExpanded ? 'icon-chevron-down' : 'icon-arrow-expand'}`}
                    onClick={onExpandToggle}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                />
                <WidgetIconButton
                    iconClassName='icon icon-close'
                    onClick={onClose}
                    title='Close'
                />
            </div>
        </div>
    );
};

export default WidgetHeader;

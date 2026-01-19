import React from 'react';
import styled from 'styled-components';

const ChannelHeaderButton = () => {
    return (
        <CallButton
            id='daakia-calls-button'
            className='style--none call-button'
        >
            <PhoneIcon className='icon icon-phone'/>
            <CallButtonText className='call-button-label'>
                {'Call'}
            </CallButtonText>
        </CallButton>
    );
};

const CallButton = styled.button`
    display: flex;
    height: 32px;
    align-items: center;
    justify-content: center;
    padding: 10px 12px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: rgb(var(--button-bg-rgb));
    fill: currentColor;
    cursor: pointer;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
    }

    &:active {
        background: rgba(var(--button-bg-rgb), 0.16);
    }
`;

const PhoneIcon = styled.i`
    font-size: 14px;
    line-height: 14px;
    color: inherit;

    &::before {
        margin: 0;
    }
`;

const CallButtonText = styled.span`
    padding: 1px 0;
    margin: 0 6px;
    font-size: 12px;
    font-weight: 600;
    line-height: 9px;
    color: inherit;
`;

export default ChannelHeaderButton;

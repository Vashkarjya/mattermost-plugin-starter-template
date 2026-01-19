import React from 'react';

import type {Post} from '@mattermost/types/posts';

import './call_post.scss';

const CallPost: React.FC<{post: Post}> = ({post}) => {
    // Get meeting URL from post props (matching your Mattermost core component)
    const meetingUrl = post.props?.meeting_url as string | undefined;

    const handleJoinCall = () => {
        if (!meetingUrl) {
            return;
        }

        // Dispatch a custom event to open the PiP with this meeting URL
        // ChannelHeader will listen for this event (matching your core behavior)
        window.dispatchEvent(new CustomEvent('daakia-join-call', {
            detail: {meetingUrl},
        }));
    };

    if (!meetingUrl) {
        // Fallback: show regular post if no meeting URL
        return <div>{post.message}</div>;
    }

    // Use standard post-message structure to inherit ALL modern post styling
    return (
        <div className='post-message'>
            <div
                className='post-message__text'
                dir='auto'
            >
                <div className='daakia-call-content'>
                    <div className='daakia-call-icon'>
                        <i className='icon icon-phone'/>
                    </div>
                    <div className='daakia-call-info'>
                        <span className='daakia-call-title'>
                            {post.message ? post.message : 'Call started'}
                        </span>
                        <button
                            className='daakia-call-join-btn'
                            onClick={handleJoinCall}
                        >
                            <i className='icon icon-phone-outline'/>
                            {'Join'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CallPost;

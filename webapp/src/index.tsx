import type {Store, Action} from 'redux';

import CallPost from './components/call_post';
import {CallWidgetContainer} from './components/call_widget';
import ChannelHeaderButton from './components/channel_header';
import IncomingCallContainer from './components/incoming_calls/call_container';
import {startCall, handleCallStarted, handleCallEnded} from './hooks/useCalls';
import manifest from './manifest';
import type {GlobalState} from './types';
// eslint-disable-next-line import/no-unresolved
import type {PluginRegistry} from './types/mattermost-webapp';

export default class Plugin {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    public async initialize(registry: PluginRegistry, store: Store<GlobalState, Action>) {
        // Register the call button in channel header
        registry.registerCallButtonAction(
            ChannelHeaderButton,
            null,
            (channel) => {
                if (channel.id) {
                    // Get team name from Redux store
                    const state = store.getState();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const currentTeam = (state as any).entities?.teams?.teams?.[(state as any).entities?.teams?.currentTeamId];
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const teamName = currentTeam?.display_name || currentTeam?.name;
                    const nameToUse = teamName || currentTeam?.name || '';
                    startCall(channel.id, nameToUse || undefined);
                }
            },
        );

        // Register incoming call notification as global component
        registry.registerGlobalComponent(IncomingCallContainer);

        // Register call widget as global component
        registry.registerGlobalComponent(CallWidgetContainer);

        // Register custom post type component for call posts
        registry.registerPostTypeComponent('custom_daakia_call', CallPost);

        // Subscribe to WebSocket events
        registry.registerWebSocketEventHandler(
            'custom_com.daakia.calls-v2_call_started',
            (event) => {
                handleCallStarted(event, store);
            },
        );

        registry.registerWebSocketEventHandler(
            'custom_com.daakia.calls-v2_call_ended',
            (event) => {
                handleCallEnded(event);
            },
        );
    }
}

declare global {
    interface Window {
        registerPlugin(pluginId: string, plugin: Plugin): void;
    }
}

window.registerPlugin(manifest.id, new Plugin());

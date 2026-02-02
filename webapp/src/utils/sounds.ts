// Sound utilities for the Daakia Calls plugin

interface WindowWithWebappUtils extends Window {
    WebappUtils?: { notificationSounds?: { ding?: () => void } };
    webkitAudioContext?: typeof AudioContext;
}

/**
 * Plays a short "connected" chime when the user joins the video call.
 * Tries Mattermost's notificationSounds first; falls back to a two-tone Web Audio chime.
 */
export function playConnectedSound(): void {
    const webappUtils = (window as WindowWithWebappUtils).WebappUtils;
    if (webappUtils?.notificationSounds?.ding) {
        try {
            webappUtils.notificationSounds.ding();
            return;
        } catch {
            // fall through to Web Audio chime
        }
    }

    try {
        const AudioContextClass = window.AudioContext || (window as WindowWithWebappUtils).webkitAudioContext;
        const audioContext = AudioContextClass ? new AudioContextClass() : null;
        if (!audioContext) {
            return;
        }
        const playTone = (frequency: number, startTime: number, duration: number) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = frequency;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };
        playTone(523.25, 0, 0.12); // C5
        playTone(659.25, 0.15, 0.2); // E5 - pleasant "connected" two-tone
    } catch (error) {
        // eslint-disable-next-line no-console
        console.debug('Could not play connected sound:', error);
    }
}

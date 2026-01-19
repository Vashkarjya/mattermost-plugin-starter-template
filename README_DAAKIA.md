# Daakia Calls Plugin - Simple Version 🔔

A simple Mattermost plugin that adds call ringing functionality. This is a basic version with:
- ✅ "Start Call" button in channel header
- ✅ Ringing notification for other users
- ✅ Answer/Decline buttons (Answer does nothing for now - to be implemented)

## What It Does

### For the Caller:
1. Click the phone icon button in any channel header
2. A call post is created in the channel
3. Other users in that channel get a ringing notification

### For Recipients:
1. See an incoming call banner in the bottom-right corner
2. Hear a ringing sound (30 seconds max)
3. Can click "Answer" (currently does nothing) or "Decline"
4. Call automatically times out after 30 seconds

## Setup

### 1. Build the Plugin

```bash
cd /Users/sogo/Desktop/mattermost-plugin-starter-template
make
```

This creates: `dist/com.daakia.calls.tar.gz`

### 2. Deploy to Mattermost

**Option A - Automatic Deploy (if Mattermost is running locally):**

```bash
export MM_SERVICESETTINGS_SITEURL=http://localhost:8065
export MM_ADMIN_USERNAME=admin
export MM_ADMIN_PASSWORD=your_password
make deploy
```

**Option B - Manual Upload:**

1. Go to **System Console** → **Plugins** → **Plugin Management**
2. Click **"Upload Plugin"**
3. Select `dist/com.daakia.calls.tar.gz`
4. Click **"Enable"** on the plugin

### 3. Enable the Plugin

In System Console → Plugins → Daakia Calls → Click **"Enable"**

## How It Works

### Server Side (`server/calls_api.go`)

**API Endpoints:**

1. **POST `/plugins/com.daakia.calls/api/v1/calls/start`**
   - Creates a call post in the channel
   - Broadcasts `call_started` WebSocket event to all channel members
   - Returns the call ID

2. **POST `/plugins/com.daakia.calls/api/v1/calls/end`**
   - Broadcasts `call_ended` WebSocket event
   - Stops ringing for all recipients

### WebSocket Events

**`call_started`** - Sent when someone starts a call:
```json
{
  "call_id": "post_id",
  "channel_id": "channel_id",
  "caller_id": "user_id",
  "caller_name": "Display Name",
  "caller_avatar_url": "https://...",
  "timestamp": 1234567890
}
```

**`call_ended`** - Sent when caller ends the call:
```json
{
  "call_id": "post_id",
  "channel_id": "channel_id",
  "ended_by": "user_id",
  "timestamp": 1234567890
}
```

### Frontend (`webapp/src/index.tsx`)

**Features:**

1. **Channel Header Button** - Phone icon added to all channel headers
2. **Custom Post Renderer** - Shows call posts with a phone icon
3. **Incoming Call Banner** - Shows at bottom-right with:
   - Caller avatar
   - Caller name
   - Answer button (green, does nothing yet)
   - Decline button (red)
4. **Ring Sound** - Simple beep tone using Web Audio API
5. **Auto-dismiss** - Ringing stops after 30 seconds

## Testing

### Test the Basic Flow:

1. **Start a call:**
   - Open any channel
   - Click the phone icon in the header
   - You should see a call post created

2. **View as another user:**
   - Open Mattermost in an incognito window (or different browser)
   - Login as a different user who is in the same channel
   - You should see:
     - Incoming call banner at bottom-right
     - Hear ringing sound
     - See caller's name and avatar

3. **Answer/Decline:**
   - Click "Decline" → banner disappears, sound stops
   - Click "Answer" → same as decline for now (to be implemented)

## File Structure

```
mattermost-plugin-starter-template/
├── plugin.json                    # Plugin metadata
├── server/
│   ├── plugin.go                  # Main plugin file
│   ├── calls_api.go              # API endpoints for calls
│   └── configuration.go          # Plugin settings
└── webapp/
    └── src/
        └── index.tsx             # Frontend logic
```

## What's Not Implemented Yet

- ❌ Actually joining/opening call (Answer button does nothing)
- ❌ Video/audio functionality (iframe to Daakia)
- ❌ Call history/database storage
- ❌ Multiple simultaneous calls
- ❌ Mobile notifications (CallKit)
- ❌ Better ring sounds

## Next Steps

To add the full calling functionality:

1. **Integrate Daakia iframe** - Show video call UI when answering
2. **Add call database** - Store call history
3. **Better UI** - Match your existing PiP design
4. **Mobile support** - Add CallKit integration

## Development

Watch mode for automatic rebuilding:

```bash
export MM_SERVICESETTINGS_SITEURL=http://localhost:8065
export MM_ADMIN_TOKEN=your_personal_access_token
make watch
```

## Troubleshooting

**Button doesn't appear:**
- Check if plugin is enabled in System Console
- Check browser console for JavaScript errors

**No ringing notification:**
- Check if both users are in the same channel
- Check WebSocket connection (look for errors in browser console)
- Make sure you're testing with different users (caller doesn't see ringing)

**Build errors:**
- Run `make clean` then `make` again
- Check that Go version is 1.19 or higher

## Support

For issues or questions, check the server logs:
- System Console → Reporting → Server Logs
- Look for messages containing "Daakia Calls"

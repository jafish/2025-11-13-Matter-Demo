# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Minimal multiplayer starter project for students building server-authoritative games. Demonstrates room-based multiplayer with Socket.IO, combining a Node.js server with a p5.js client.

**What it does:**
- Players join named rooms (max 3 players per room)
- Each room is isolated - players in different rooms don't see each other
- Includes a simple messaging system to demonstrate client↔server communication
- Provides scaffolded comments showing where to add game features

**What it does NOT do:**
- No game logic (students add this)
- No physics engine (students can add Matter.js, p5.play, or custom physics)
- No scoring, game objects, or gameplay mechanics (students implement these)

This starter is designed to help students transition from using an "echo server" (which automatically forwards all messages) to writing their own server logic that controls what data gets sent to whom.

## Commands

### Setup
```bash
npm install       # Install dependencies (express, socket.io)
npm start         # Start server on port 3000
```

### Testing Multiplayer Rooms
1. Open http://localhost:3000 in a browser tab
2. Enter username "Alice" and room "room1", click Join
3. Open another tab, enter username "Bob" and room "room1"
4. Both players now share the same room - messages sent by one appear for both
5. Open a third tab, enter username "Charlie" and room "room1" - all 3 share messages
6. Open a fourth tab and try to join "room1" - you'll get "Room full" error
7. Open a tab with username "Dave" and room "room2" - this creates a new isolated room

## Architecture

### Server-Side (server.js)

**Room Management:**
- `users` array tracks all connected users: `{ id, username, room }`
- `MAX_PLAYERS_PER_ROOM` constant (currently 3) limits room size
- Helper functions manage user lifecycle:
  - `userJoin(id, username, room)` - Add user to tracking
  - `getCurrentUser(id)` - Look up user by socket ID
  - `userLeave(id)` - Remove user when disconnecting
  - `getRoomUsers(room)` - Get all users in a specific room

**Socket.IO Events (Server receives from clients):**
- `joinRoom` - Client requests to join with `{ username, room }`
  - Server checks if room is full
  - Rejects with `roomFull` event if at capacity
  - Accepts by calling `socket.join(room)` and sending `joinSuccess`
  - Broadcasts updated `roomInfo` to everyone in room
- `sendMessage` - Client sends `{ message }`
  - Server looks up which room the user is in
  - Broadcasts `newMessage` to all players in that room only
- `disconnect` - Automatic when client closes
  - Server removes user from tracking
  - Broadcasts updated `roomInfo` to remaining players in room

**Key Server Pattern:**
```javascript
socket.on('eventFromClient', (data) => {
    const user = getCurrentUser(socket.id);  // Find which room they're in
    if (!user) return;

    // Process data, validate, update server state...

    // Send to everyone in this room:
    io.to(user.room).emit('eventToClients', { ... });
});
```

### Client-Side (index.html)

**Join Screen:**
- Two input fields: username and room name
- On submit, sends `joinRoom` event to server
- Listens for `roomFull` (error) or `joinSuccess` (accepted)
- Switches to game screen when accepted

**Game Screen:**
- **Room Info Panel**: Shows room name, player count, and player names
- **p5.js Canvas**: 600x500 canvas for rendering (currently just shows player list)
- **Chat Panel**: Messaging interface to demonstrate Socket.IO communication

**Socket Event Pattern:**
```javascript
// Send to server:
socket.emit('eventName', { data: value });

// Receive from server:
socket.on('eventName', (data) => {
    // Update UI or game state
});
```

**p5.js Integration:**
- `setup()` - Creates canvas, initializes game state
- `draw()` - Runs at 60 FPS, renders game visuals
- `mousePressed()` - Handles click input
- Students add game logic in these functions

## File Structure

```
server.js        (~200 lines) - Node.js server with room management and Socket.IO
index.html       (~510 lines) - Join screen + p5.js client + messaging UI
package.json     - Dependencies (express, socket.io only)
CLAUDE.md        - This documentation file
```

All code is in these files - no build system or bundler required for simplicity.

## Key Concepts for Students

### Echo Server vs Custom Server

**Echo Server (previous project):**
- Automatically forwarded all `socket.emit()` to all connected clients
- Students couldn't see or control server logic
- No concept of rooms or selective broadcasting

**This Custom Server:**
- Students write server-side event handlers in `server.js`
- Students decide what data to send and to whom
- Students can validate, modify, or reject client requests
- Students control room isolation with `io.to(room).emit()`

### Room Isolation

Rooms are like separate "universes" - players in `room1` never receive events sent to `room2`.

Server uses `io.to(roomName).emit()` to broadcast only to players in that room:
```javascript
io.to(user.room).emit('gameUpdate', { /* data */ });  // Only this room receives it
```

### Broadcasting Patterns

**Send to one client only (the one that triggered the event):**
```javascript
socket.emit('privateMessage', { data });
```

**Send to all clients in a room:**
```javascript
io.to(roomName).emit('roomUpdate', { data });
```

**Send to all clients on entire server (rare with rooms):**
```javascript
io.emit('serverAnnouncement', { data });
```

## Adding Game Features

The code includes extensive `🎓 STUDENT INSTRUCTIONS` comments showing where to add features. Here's the general pattern:

### 1. Define Game State (client-side)

In `index.html`, add variables after the existing state:
```javascript
let playerPositions = {};  // { username: { x, y } }
let score = 0;
```

### 2. Send Events to Server (client-side)

```javascript
// In draw() or mousePressed():
socket.emit('playerMove', { x: mouseX, y: mouseY });
```

### 3. Handle Events on Server (server-side)

In `server.js`, add a new handler inside `io.on('connection', ...)`:
```javascript
socket.on('playerMove', (data) => {
    const user = getCurrentUser(socket.id);
    if (!user) return;

    // Validate data.x and data.y...

    // Broadcast to everyone in room
    io.to(user.room).emit('playerMoved', {
        username: user.username,
        x: data.x,
        y: data.y
    });
});
```

### 4. Receive Events on Client (client-side)

In `index.html`, add a listener:
```javascript
socket.on('playerMoved', (data) => {
    playerPositions[data.username] = { x: data.x, y: data.y };
});
```

### 5. Render in p5.js (client-side)

In the `draw()` function:
```javascript
for (let username in playerPositions) {
    let pos = playerPositions[username];
    fill(100, 200, 100);
    ellipse(pos.x, pos.y, 30, 30);
    text(username, pos.x, pos.y - 20);
}
```

## Common Student Implementations

Students typically add:

**Player Movement:**
- Track each player's position on server
- Broadcast position updates to room
- Render all players on each client's canvas

**Game Objects:**
- Server creates objects with unique IDs
- Server broadcasts object creation/deletion
- Clients render objects from server state

**Turn-Based Logic:**
- Server tracks whose turn it is
- Server validates actions (only accept from current player)
- Server broadcasts turn changes

**Scoring System:**
- Server maintains score for each player
- Server validates score changes (prevent cheating)
- Server broadcasts score updates

**Collectibles/Power-ups:**
- Server spawns items at random positions
- Client sends "collect" event when touching item
- Server validates (is player close enough?) and removes item
- Server broadcasts item removal to all players

## Debugging Tips

### Server Console
```
Client connected: abc123
User Alice attempting to join room: room1
Alice joined room room1. Players: 1/3
[room1] Alice: Hello!
Client disconnected: Alice from room room1
```

### Client Console (Browser DevTools - F12)
- Check `console.log()` output to see data flow
- Inspect `players` array to see who's in room
- Monitor socket connection status
- Check for errors in event handlers

### Common Issues

**"Room full" when joining:**
- Room already has `MAX_PLAYERS_PER_ROOM` players
- Try a different room name or increase the limit in `server.js`

**Messages not appearing:**
- Check that client is sending to correct event name
- Check that server is listening for that event name
- Check that server is broadcasting back to the room
- Check browser console for errors

**Seeing other rooms' data:**
- Server must use `io.to(user.room).emit()` not `io.emit()`
- Check that `getCurrentUser()` is being called to find user's room

**Player names not updating:**
- The `roomInfo` event should trigger on join and disconnect
- Check that client has `socket.on('roomInfo', ...)` handler

## Testing Checklist

- [ ] Can join a room successfully
- [ ] Room full error appears when 4th player tries to join
- [ ] Player names appear in room info panel
- [ ] Player names appear on canvas
- [ ] Chat messages appear for all players in room
- [ ] Players in different rooms don't see each other's messages
- [ ] When player disconnects, their name disappears from room info
- [ ] Multiple rooms can exist simultaneously without interference

## Next Steps for Students

Once comfortable with the starter:

1. **Add visual player representation** - Show each player as a colored circle/sprite
2. **Implement player movement** - Use arrow keys or mouse to control position
3. **Add game mechanics** - Scoring, collectibles, obstacles, etc.
4. **Implement game objects** - Server-controlled entities all players can see
5. **Add game states** - Lobby, playing, game over screens
6. **Implement win conditions** - Detect and broadcast when someone wins
7. **Add visual polish** - Animations, particles, sound effects

Remember: Server is the "source of truth" - validate and control game state on server, not client!

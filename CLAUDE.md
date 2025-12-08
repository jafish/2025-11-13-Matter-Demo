# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Minimal multiplayer starter project for students building server-authoritative games. Demonstrates basic Socket.IO communication between a Node.js server and p5.js clients. All players share one connected space.

**What it does:**
- Players connect by entering a username
- All players see each other (no limit on player count)
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

### Testing Multiplayer
1. Open http://localhost:3000 in a browser tab
2. Enter username "Alice", click Join
3. Open another tab, enter username "Bob"
4. Both players now share the same space - messages sent by one appear for both
5. Open more tabs with different usernames - all players can see each other

## Architecture

### Server-Side (server.js)

**User Management:**
- `users` array tracks all connected users: `{ id, username }`
- Helper functions manage user lifecycle:
  - `userJoin(id, username)` - Add user to tracking
  - `getCurrentUser(id)` - Look up user by socket ID
  - `userLeave(id)` - Remove user when disconnecting
  - `getAllUsers()` - Get all connected users

**Socket.IO Events (Server receives from clients):**
- `join` - Client requests to join with `{ username }`
  - Server adds user to tracking
  - Sends `joinSuccess` to that client
  - Broadcasts updated `userList` to all connected clients
- `sendMessage` - Client sends `{ message }`
  - Server looks up the user's username
  - Broadcasts `newMessage` to all connected clients
- `disconnect` - Automatic when client closes
  - Server removes user from tracking
  - Broadcasts updated `userList` to all remaining clients

**Key Server Pattern:**
```javascript
socket.on('eventFromClient', (data) => {
    const user = getCurrentUser(socket.id);  // Find which user this is
    if (!user) return;

    // Process data, validate, update server state...

    // Send to everyone:
    io.emit('eventToClients', { ... });
});
```

### Client-Side (index.html)

**Join Screen:**
- One input field: username
- On submit, sends `join` event to server
- Listens for `joinSuccess` (accepted)
- Switches to game screen when accepted

**Game Screen:**
- **Player Info Panel**: Shows total player count and all player names
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
server.js        (~215 lines) - Node.js server with user management and Socket.IO
index.html       (~510 lines) - Join screen + p5.js client + messaging UI
package.json     - Dependencies (express, socket.io only)
CLAUDE.md        - This documentation file
```

All code is in these files - no build system or bundler required for simplicity.

## Key Concepts for Students

### Echo Server vs Custom Server

**Echo Server (previous project):**
- Students did `socket.emit('event', data)` on the client
- The echo server automatically forwarded it to **all connected clients**
- From student perspective, `socket.emit()` seemed to broadcast to everyone
- Students couldn't see or control server logic
- No validation or custom behavior possible

**This Custom Server:**
- Students still do `socket.emit('event', data)` on the client (same syntax!)
- But now it goes to **their own server** (server.js), not to other clients
- Students write server-side event handlers in `server.js`
- Students decide what data to send and to whom:
  - `socket.emit()` on server = send to ONE client
  - `io.emit()` = send to ALL connected clients
- Students can validate, modify, or reject client requests
- Server is the "source of truth" for game state

**Key Learning Transition:**
- Client-side `socket.emit()` **always** goes to the server (never directly to other clients)
- Server-side code determines who receives what and when
- This is how real multiplayer games work - server is the authority!

**Visual Comparison:**

```
ECHO SERVER (previous):
┌─────────┐                  ┌─────────────┐                 ┌─────────┐
│ Client1 │─socket.emit()──→ │ Echo Server │ ─automatically→ │ Client2 │
└─────────┘                  │  (hidden)   │ ─forwards to──→ │ Client3 │
                             └─────────────┘ ─everyone───→   │ Client4 │
                                                              └─────────┘
YOUR CUSTOM SERVER (this project):
┌─────────┐                  ┌──────────────────┐            ┌─────────┐
│ Client1 │─socket.emit()──→ │  YOUR server.js  │            │ Client2 │
└─────────┘                  │                  │            │ Client3 │
                             │ YOU decide:      │            │ Client4 │
                             │ • Validate data  │            └─────────┘
                             │ • Update state   │                 ↑
                             │ • Who gets it?   │                 │
                             └──────────────────┘                 │
                                      │                           │
                                      └────io.emit()──────────────┘
                                        (YOU control this!)
```

### Broadcasting Patterns

**Important:** These patterns are used **on the server** (in server.js), not on the client!

**Send to one client only (the one that triggered the event):**
```javascript
socket.emit('privateMessage', { data });
```

**Send to all connected clients:**
```javascript
io.emit('broadcast', { data });
```

**Example - Complete Message Flow:**

```javascript
// CLIENT (index.html):
socket.emit('playerMove', { x: 100, y: 200 });
// ↓ This goes to the server ONLY

// SERVER (server.js):
socket.on('playerMove', (data) => {
    const user = getCurrentUser(socket.id);
    // Server validates, processes, decides...

    io.emit('playerMoved', {
        username: user.username,
        x: data.x,
        y: data.y
    });
    // ↓ This goes to ALL connected clients
});

// ALL CLIENTS (index.html):
socket.on('playerMoved', (data) => {
    // Update game state
    playerPositions[data.username] = { x: data.x, y: data.y };
});
```

This is different from echo server where step 2 was automatic and hidden!

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

    // Broadcast to everyone
    io.emit('playerMoved', {
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
- Broadcast position updates to all players
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
User Alice joining
Alice joined. Total players: 1
Alice: Hello!
Client disconnected: Alice
```

### Client Console (Browser DevTools - F12)
- Check `console.log()` output to see data flow
- Inspect `players` array to see who's connected
- Monitor socket connection status
- Check for errors in event handlers

### Common Issues

**Messages not appearing:**
- Check that client is sending to correct event name
- Check that server is listening for that event name
- Check that server is broadcasting back
- Check browser console for errors

**Player names not updating:**
- The `userList` event should trigger on join and disconnect
- Check that client has `socket.on('userList', ...)` handler

**Duplicate usernames:**
- This starter allows duplicate names
- Students can add username validation on server if desired

## Testing Checklist

- [ ] Can join successfully
- [ ] Player names appear in info panel
- [ ] Player names appear on canvas
- [ ] Chat messages appear for all players
- [ ] When player disconnects, their name disappears
- [ ] Multiple players can coexist

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

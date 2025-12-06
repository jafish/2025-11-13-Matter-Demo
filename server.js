'use strict';

// ====== IMPORTS ======
const express = require('express');
const socketIO = require('socket.io');
const path = require('path');

// ====== SERVER SETUP ======
const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');

// Create Express server and serve the HTML file
const server = express()
    .use((req, res) => res.sendFile(INDEX))
    .listen(PORT, () => console.log(`Listening on ${PORT}`));

// Attach Socket.IO to the server
const io = socketIO(server);

// ====== ROOM MANAGEMENT ======
// Unlike the "echo server" you used before, we now manage ROOMS
// Players in different rooms cannot see each other's messages/data

const MAX_PLAYERS_PER_ROOM = 2; // Change this to allow more/fewer players per room
const users = []; // Array to track all connected users: { id, username, room }

// Helper: Add a user to a room
function userJoin(id, username, room) {
    const user = { id, username, room };
    users.push(user);
    return user;
}

// Helper: Find a user by their socket ID
function getCurrentUser(id) {
    return users.find(user => user.id === id);
}

// Helper: Remove a user when they disconnect
function userLeave(id) {
    const index = users.findIndex(user => user.id === id);
    if (index !== -1) {
        return users.splice(index, 1)[0];
    }
}

// Helper: Get all users in a specific room
function getRoomUsers(room) {
    return users.filter(user => user.room === room);
}

// ====== SOCKET.IO EVENT HANDLERS ======
// This is where YOU control what happens when clients send events
//
// KEY DIFFERENCE FROM ECHO SERVER:
// - Echo server: When client did socket.emit(), the echo server automatically
//   sent that message to ALL connected clients (you had no control)
// - This server: When client does socket.emit(), YOU decide:
//   - Send back to just that one client? Use socket.emit()
//   - Send to everyone in their room? Use io.to(room).emit()
//   - Send to everyone on server? Use io.emit()

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // ====== EVENT: JOIN ROOM ======
    // Client sends: { username, room }
    // Server decides: Allow join or reject if room is full
    socket.on('joinRoom', ({ username, room }) => {
        console.log(`User ${username} attempting to join room: ${room}`);

        // CHECK: Is the room full?
        if (getRoomUsers(room).length >= MAX_PLAYERS_PER_ROOM) {
            // Send rejection message to THIS client only
            socket.emit('roomFull', {
                message: `Room "${room}" is full! Maximum ${MAX_PLAYERS_PER_ROOM} players allowed.`
            });
            console.log(`Room ${room} is full. User ${username} rejected.`);
            return; // Stop here - don't let them join
        }

        // Add user to our tracking array
        const user = userJoin(socket.id, username, room);

        // Join the Socket.IO room (this groups sockets together)
        socket.join(user.room);

        // Send success message to THIS client only
        // IMPORTANT: socket.emit() sends to ONE client (this specific socket)
        // Compare with io.to().emit() below which sends to ALL clients in room
        socket.emit('joinSuccess', {
            room: user.room,
            username: user.username
        });

        // Broadcast updated room info to EVERYONE in this room
        // IMPORTANT: io.to(room).emit() sends to ALL clients in that room
        // Compare with socket.emit() above which sends to just ONE client
        const roomUsers = getRoomUsers(user.room);
        io.to(user.room).emit('roomInfo', {
            room: user.room,
            playerCount: roomUsers.length,
            maxPlayers: MAX_PLAYERS_PER_ROOM,
            players: roomUsers.map(u => u.username)
        });

        console.log(`${username} joined room ${room}. Players: ${roomUsers.length}/${MAX_PLAYERS_PER_ROOM}`);
    });

    // ====== EVENT: SEND MESSAGE ======
    // Client sends: { message }
    // Server decides: Broadcast to everyone in the same room
    //
    // ECHO SERVER COMPARISON:
    // - Old way (echo server): Client's socket.emit() automatically went to everyone
    // - New way (your server): Client's socket.emit() comes here, YOU broadcast it
    socket.on('sendMessage', (data) => {
        // Look up which user this socket belongs to
        const user = getCurrentUser(socket.id);
        if (!user) return; // Safety check - user must be in a room

        // NOW you broadcast it to everyone in the room using io.to().emit()
        // (The echo server did this automatically; now YOU control it)
        io.to(user.room).emit('newMessage', {
            username: user.username,
            message: data.message,
            timestamp: Date.now()
        });

        console.log(`[${user.room}] ${user.username}: ${data.message}`);
    });

    // ====== EVENT: DISCONNECT ======
    // Automatically triggered when a client disconnects
    socket.on('disconnect', () => {
        const user = userLeave(socket.id);

        if (user) {
            console.log(`Client disconnected: ${user.username} from room ${user.room}`);

            // Update everyone in the room about the new player list
            const roomUsers = getRoomUsers(user.room);
            io.to(user.room).emit('roomInfo', {
                room: user.room,
                playerCount: roomUsers.length,
                maxPlayers: MAX_PLAYERS_PER_ROOM,
                players: roomUsers.map(u => u.username)
            });
        }
    });

    // ====================================================================
    // 🎓 STUDENT INSTRUCTIONS: HOW TO ADD NEW FEATURES
    // ====================================================================
    //
    // REMEMBER: Unlike the echo server, socket.emit() from client goes to SERVER,
    // not to other clients. YOU control who receives what by using io.to().emit()
    //
    // To add a new feature, follow this pattern:
    //
    // 1. CLIENT sends an event (goes to SERVER, not other clients):
    //    socket.emit('yourEventName', { yourData: value });
    //
    // 2. SERVER receives and handles it (YOU decide what to do):
    //    socket.on('yourEventName', (data) => {
    //        const user = getCurrentUser(socket.id);
    //        if (!user) return;
    //
    //        // Process the data (validate, update server state, etc.)...
    //
    //        // Send to just this client:
    //        socket.emit('responseEvent', { ... });
    //
    //        // OR send to everyone in this room:
    //        io.to(user.room).emit('responseEvent', { ... });
    //    });
    //
    // 3. CLIENT receives the response:
    //    socket.on('responseEvent', (data) => {
    //        // Update your UI or game state
    //    });
    //
    // ====================================================================
    // EXAMPLES OF FEATURES YOU COULD ADD:
    // ====================================================================
    //
    // • Game state synchronization (positions, scores, etc.)
    //   - Client sends position updates
    //   - Server validates and broadcasts to room
    //
    // • Turn-based game logic
    //   - Server tracks whose turn it is
    //   - Server validates moves and updates game state
    //
    // • Scoring system
    //   - Server maintains score for each player
    //   - Server broadcasts score updates to room
    //
    // • Custom game objects (collectibles, obstacles, etc.)
    //   - Server creates objects with unique IDs
    //   - Server broadcasts object creation/deletion to room
    //
    // ====================================================================
    // KEY CONCEPTS TO REMEMBER:
    // ====================================================================
    //
    // IMPORTANT: CLIENT vs SERVER socket.emit()
    //
    // When CLIENT does:     socket.emit('event', data)
    //   → Always sends to the SERVER only (never directly to other clients)
    //
    // When SERVER does:     socket.emit('event', data)
    //   → Sends to ONE specific client (the socket that triggered this)
    //
    // ECHO SERVER vs YOUR CUSTOM SERVER:
    //
    // Echo Server (previous project):
    //   - Client: socket.emit('move', {x, y})
    //   - Echo server automatically sent to ALL clients
    //   - You had no control over who received what
    //
    // Your Custom Server (this project):
    //   - Client: socket.emit('move', {x, y})
    //   - Server receives it in socket.on('move', callback)
    //   - YOU decide what to do:
    //       socket.emit()          → Reply to just this one client
    //       io.to(user.room).emit()→ Send to everyone in their room
    //       io.emit()              → Send to everyone on the server
    //
    // ROOM MANAGEMENT:
    //
    // socket.join(room)    → Add this socket to a room group
    // socket.leave(room)   → Remove this socket from a room group
    //
    // HELPER FUNCTIONS:
    //
    // getCurrentUser()     → Find which user/room this socket belongs to
    // getRoomUsers()       → Get all users in a specific room
    //
    // ====================================================================
});

console.log('Server started successfully!');
console.log(`Visit http://localhost:${PORT} to connect`);

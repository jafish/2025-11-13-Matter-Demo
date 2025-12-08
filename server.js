'use strict';

// ====================================================================
// Imports
// ====================================================================
const express = require('express');
const socketIO = require('socket.io');
const path = require('path');

// ====================================================================
// Server setup
// ====================================================================
const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');

// Create Express server and serve the HTML file
const server = express()
    .use((req, res) => res.sendFile(INDEX))
    .listen(PORT, () => console.log(`Listening on ${PORT}`));

// Attach Socket.IO to the server
const io = socketIO(server);

// ====================================================================
// User management
// ====================================================================
// All connected users share the same space
const users = []; // Array to track all connected users: { id, username }

// Helper: Add a user
function userJoin(id, username) {
    const user = { id, username };
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

// Helper: Get all connected users
function getAllUsers() {
    return users;
}

// ====================================================================
// socket.io event handlers
// ====================================================================
// This is where you control what happens when clients send events
//
// Key difference from echo server:
// - Echo server: When client did socket.emit(), the echo server automatically
//   sent that message to all connected clients (you had no control)
// - This server: When client does socket.emit(), you decide:
//   - Send back to just that one client? Use socket.emit()
//   - Send to everyone on server? Use io.emit()

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // ====================================================================
    // Event: join
    // ====================================================================
    // Client sends: { username }
    // Server decides: Allow join and notify everyone
    socket.on('join', ({ username }) => {
        console.log(`User ${username} joining`);

        // Add user to our tracking array
        const user = userJoin(socket.id, username);

        // Send success message to this client only
        // Important: socket.emit() sends to one client (this specific socket)
        // Compare with io.emit() below which sends to all clients
        socket.emit('joinSuccess', {
            username: user.username
        });

        // Broadcast updated user list to everyone
        // Important: io.emit() sends to all connected clients
        // Compare with socket.emit() above which sends to just one client
        const allUsers = getAllUsers();
        io.emit('userList', {
            playerCount: allUsers.length,
            players: allUsers.map(u => u.username)
        });

        console.log(`${username} joined. Total players: ${allUsers.length}`);
    });

    // ====================================================================
    // Event: send message
    // ====================================================================
    // Client sends: { message }
    // Server decides: Broadcast to everyone
    //
    // Echo server comparison:
    // - Old way (echo server): Client's socket.emit() automatically went to everyone
    // - New way (your server): Client's socket.emit() comes here, you broadcast it
    socket.on('sendMessage', (data) => {
        // Look up which user this socket belongs to
        const user = getCurrentUser(socket.id);
        if (!user) return; // Safety check - user must have joined

        // Now you broadcast it to everyone using io.emit()
        // (The echo server did this automatically; now you control it)
        io.emit('newMessage', {
            username: user.username,
            message: data.message,
            timestamp: Date.now()
        });

        console.log(`${user.username}: ${data.message}`);
    });

    // ====================================================================
    // Event: disconnect
    // ====================================================================
    // Automatically triggered when a client disconnects
    socket.on('disconnect', () => {
        const user = userLeave(socket.id);

        if (user) {
            console.log(`Client disconnected: ${user.username}`);

            // Update everyone about the new player list
            const allUsers = getAllUsers();
            io.emit('userList', {
                playerCount: allUsers.length,
                players: allUsers.map(u => u.username)
            });
        }
    });

    // ====================================================================
    // Instructions for you: How to add new features
    // ====================================================================
    //
    // Remember: Unlike the echo server, socket.emit() from client goes to server,
    // not to other clients. You control who receives what by using io.emit()
    //
    // To add a new feature, follow this pattern:
    //
    // 1. Client sends an event (goes to server, not other clients):
    //    socket.emit('yourEventName', { yourData: value });
    //
    // 2. Server receives and handles it (you decide what to do):
    //    socket.on('yourEventName', (data) => {
    //        const user = getCurrentUser(socket.id);
    //        if (!user) return;
    //
    //        // Process the data (validate, update server state, etc.)...
    //
    //        // Send to just this client:
    //        socket.emit('responseEvent', { ... });
    //
    //        // OR send to everyone:
    //        io.emit('responseEvent', { ... });
    //    });
    //
    // 3. Client receives the response:
    //    socket.on('responseEvent', (data) => {
    //        // Update your UI or game state
    //    });
    //
    // ====================================================================
    // Examples of features you could add:
    // ====================================================================
    //
    // • Game state synchronization (positions, scores, etc.)
    //   - Client sends position updates
    //   - Server validates and broadcasts to all players
    //
    // • Turn-based game logic
    //   - Server tracks whose turn it is
    //   - Server validates moves and updates game state
    //
    // • Scoring system
    //   - Server maintains score for each player
    //   - Server broadcasts score updates to all players
    //
    // • Custom game objects (collectibles, obstacles, etc.)
    //   - Server creates objects with unique IDs
    //   - Server broadcasts object creation/deletion to all players
    //
    // ====================================================================
    // Key concepts to remember:
    // ====================================================================
    //
    // Important: Client vs Server socket.emit()
    //
    // When client does:     socket.emit('event', data)
    //   → Always sends to the server only (never directly to other clients)
    //
    // When server does:     socket.emit('event', data)
    //   → Sends to one specific client (the socket that triggered this)
    //
    // Echo server vs your custom server:
    //
    // Echo Server (previous project):
    //   - Client: socket.emit('move', {x, y})
    //   - Echo server automatically sent to all clients
    //   - You had no control over who received what
    //
    // Your custom server (this project):
    //   - Client: socket.emit('move', {x, y})
    //   - Server receives it in socket.on('move', callback)
    //   - You decide what to do:
    //       socket.emit()  → Reply to just this one client
    //       io.emit()      → Send to everyone on the server
    //
    // Helper functions:
    //
    // getCurrentUser()     → Find which user this socket belongs to
    // getAllUsers()        → Get all connected users
    //
    // ====================================================================
});

console.log('Server started successfully!');
console.log(`Visit http://localhost:${PORT} to connect`);

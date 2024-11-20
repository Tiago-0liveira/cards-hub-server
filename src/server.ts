import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { readUsersFromFile } from './utils';


import roomsHandler, { leaveRoomHandler } from "./ws-handlers/room"
import userHandler from "./ws-handlers/user"
import cardGamesHandler from "./ws-handlers/cardGames"
import { RoomStateBase } from './enums';

dotenv.config();
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

const corsOptions = {
	origin: ["http://localhost:5173", "http://94.63.177.7:5173", "http://localhost:4173", "http://94.63.177.7:4173"], // replace with your frontend URL
	methods: ['GET', 'POST'],
	allowedHeaders: ['Content-Type'],
	credentials: true,
};
/*app.use(cors(corsOptions));*/
const io = new Server(server, {
	cors: corsOptions
});

const users: Record<string, User> = readUsersFromFile();
const rooms: Record<string, Room> = {};

app.get('/', (req, res) => {
	res.send('Card game server is running');
});

io.on('connection', (socket) => {
	console.log('A user connected:', socket.id);


	roomsHandler(io, socket, rooms, users);
	userHandler(io, socket, rooms, users);
	cardGamesHandler(io, socket, rooms, users);
	
	// Handle disconnecting from a channel and cleaning up
	socket.on('disconnect', () => {
		console.log('User disconnected:', socket.id);
		for (const [roomId, room] of Object.entries(rooms)) {
			const player = room.players.find((u) => u.socketId === socket.id);
			console.log("Disconnected player::", player)
			if (!player)
				continue;
			leaveRoomHandler(io, socket, rooms, users)({id: roomId, userId: player.id})

			// If the room operator disconnected, close the room or assign a new operator
			/*if (room.operator === socket.id) {
				if (room.players.length > 0) {
					room.operator = room.players[0].id;
					io.to(roomId).emit('operatorChanged', { operator: room.operator });
					console.log(`New operator for room ${roomId} is ${room.operator}`);
				}
			}*/
			break;
		}
	});
});

server.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});

import { Server, Socket } from "socket.io";
import { createRandomId } from "../utils";
import { GameType, RoomStateBase } from "../enums";
import { ensureRoomExists, onPlayerJoinRoom, onPlayerLeaveRoom, onSetUserReady } from "../games/general";

export const leaveRoomHandler = (io: Server, socket: Socket, rooms: Record<string, Room>, users: Record<string, User>) => ({ id, userId }: { id: string, userId: string }) => {
	console.log(`--------leaveRoom::id:${id}::userId::${userId}`)
	const r = rooms[id]
	if (!r) {
		socket.emit("error", "Room not found")
		return
	}

	const p = r.players.find(u => u.id === userId)
	if (!p)
	{
		socket.emit("error", "Player not found")
		return
	}
	onPlayerLeaveRoom(r.type, io, r, rooms, p)

	r.players = r.players.filter((value) => value.socketId !== socket.id)

	io.emit("playerLeftRoom", { rooms })
	socket.leave(id)
	console.log(`User ${socket.id} left room ${id}`)
}

const handler = (io: Server, socket: Socket, rooms: Record<string, Room>, users: Record<string, User>) => {
	socket.on("getRooms", () => {
		socket.emit("rooms", rooms)
	})
	
	socket.on('newRoom', (newChannelFormData: NewRoomFormData) => {
		console.log(JSON.stringify(newChannelFormData))
		if (!newChannelFormData || newChannelFormData.roomName === undefined || newChannelFormData.gameType === undefined) {
			socket.emit('error', 'Room name is required');
			return;
		}
		const room = Object.entries(rooms).find(([id, room]) => room.name === newChannelFormData.roomName)
		if (room !== undefined)
		{
			console.log(`room ${room[1].name} already exists!`)
			socket.emit("error", "Room name already exists!")
			return;
		}
	
		const roomId = createRandomId();
		// TODO: Check if already exists
		rooms[roomId] = { state: RoomStateBase.IDLE, id: roomId, operator: newChannelFormData.user_id, players: [], spectators: [], name: newChannelFormData.roomName, type: newChannelFormData.gameType }; // Operator is the creator
		ensureRoomExists(rooms, roomId)

		socket.join(roomId);
		io.emit('roomCreated', rooms[roomId]);
		console.log(`Channel created: ${roomId} by ${socket.id}`);
	});

	socket.on("deleteRoom", (deleteRoomData: DeleteRoomData) => {
		console.log("deleteRoom::deleteRoomData::", deleteRoomData);
		if (deleteRoomData === undefined || deleteRoomData.id === undefined) {
			socket.emit("error", "Room name is required and must be valid")
			return
		}
	
		const room = rooms[deleteRoomData.id];
		if (room === undefined) {
			socket.emit("error", "Room name is required and must be valid")
			return
		}
		const user = Object.values(users).find(u => u.id === deleteRoomData.userId)
		if (!user)
		{
			socket.emit("error", "Could not find the user that is trying to delete the room, sync error")
			return
		}
		if (room.operator !== user.id) {
			socket.emit("error", "The Room operator is the only one who can delete the room!")
			return
		}
		rooms[deleteRoomData.id].players.forEach(u => {
			const userSocket = io.sockets.sockets.get(u.socketId)
			if (userSocket)
			{
				userSocket.emit("goToLobby");
			} else {
				console.log(`deleteRoom::could not find socket for user::${u.username}`)
			}
		})
		delete rooms[deleteRoomData.id];
		io.emit("roomDeleted", room.name);
	})
	

	socket.on('joinRoom', (arg: { id: string, userId: string }) => {
		console.log(`---------joinRoom::${arg.id}::${arg.userId}----------`)
		if (!rooms[arg.id]) {
			socket.emit('error', 'Room not found');
			return;
		}
		const user = Object.values(users).find((u) => u.id === arg.userId)
		if (!user) {
			socket.emit("error", "Invalid socket");
			return;
		}
		
		const isInAnotherRoom = Object.entries(rooms).find(ent => ent[1].players.some(u => u.id === arg.userId))
		if (isInAnotherRoom && isInAnotherRoom[0] !== arg.id)
		{
			socket.emit("error", "You cannot join another room while in a room with a ongoing game!");
			return;
		}
		
		rooms[arg.id].players.push(user)
		onPlayerJoinRoom(rooms[arg.id].type, io, rooms[arg.id], rooms, user)
		// TODO: activate code in the future for allowing spectators
		/*if (rooms[arg.id].state === RoomStateBase.IDLE) {
			console.log("added players")
			
		}
		else if (rooms[arg.id].state === RoomStateBase.ONGOING) {
			console.log("added spectators")
			rooms[arg.id].spectators.push({...user, ready:false})
			// TODO: create function in the future for spectators 
			// onSpectatorJoinRoom
		}*/
		
		socket.emit("enterRoom", { room: rooms[arg.id] })
		io.emit('playerJoinedRoom', { rooms });
		socket.join(arg.id);
		console.log(`User ${socket.id} joined room: ${arg.id}`);
	});

	socket.on("setUserReady", ({ roomId, ready, userId }: {roomId: string, userId: string, ready: boolean}) => {
		const player = rooms[roomId]?.players.find((u)=> u.id === userId)
		console.log(player?.username, " ", ready)
		if (player)
			player.ready = ready
		onSetUserReady(rooms[roomId].type, io, rooms[roomId], userId, ready)
		io.to(roomId).emit("readyUpdate", { roomId, ready, userId })
	})
	
	socket.on("leaveRoom", leaveRoomHandler(io, socket, rooms, users))
}

export default handler


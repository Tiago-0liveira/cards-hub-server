import { Server } from "socket.io";
import { GameType } from "../enums"
import { olhoOnPlayerJoinRoom, olhoOnPlayerLeaveRoom, olhoOnSetUserReady, olhoRoomGameStructInitializer } from "./Olho";


export function ensureRoomExists(rooms: Record<string, Room>, roomId: string) {
	switch (rooms[roomId].type) {
		case GameType.OLHO:
			olhoRoomGameStructInitializer(rooms[roomId])
			break;
		default:
			throw Error("You forgot to define something or something is wrong")
	}
}

export function onPlayerJoinRoom(gameType: GameType, io: Server, room: Room, rooms: Record<string, Room>, user: User) {
	switch (gameType) {
		case GameType.OLHO:
			olhoOnPlayerJoinRoom(io, room, rooms, user)
			break;
		default:
			throw Error("You forgot to define something or something is wrong")
	}
}

export function onPlayerLeaveRoom(gameType: GameType, io: Server, room: Room, rooms: Record<string, Room>, user: User) {
	switch (gameType) {
		case GameType.OLHO:
			olhoOnPlayerLeaveRoom(io, room, rooms, user)
			break;
		default:
			throw Error("You forgot to define something or something is wrong")
	}
}

export function onSetUserReady(gameType: GameType, io: Server, room: Room, userId: string, ready: boolean) {
	switch (gameType) {
		case GameType.OLHO:
			olhoOnSetUserReady(io, room, userId, ready)
			break;
		default:
			throw Error("You forgot to define something or something is wrong")
	}
}
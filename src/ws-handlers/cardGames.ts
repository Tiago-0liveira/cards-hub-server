import { Server, Socket } from "socket.io"
import { createRandomId, saveUsersToFile } from "../utils"
import { olhoSocketHandler } from "../games/Olho"

const handler = (io: Server, socket: Socket, rooms: Record<string, Room>, users: Record<string, User>) => {
	olhoSocketHandler(io, socket, rooms, users)
}


export default handler
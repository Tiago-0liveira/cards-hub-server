import { Server, Socket } from "socket.io"
import { createRandomId, saveUsersToFile } from "../utils"

const socketSendUserUpdate = (socket: Socket, users: Record<string, User>, user: User) => {
	const u = Object.keys(users).find(uid => uid === user.id)
	if (u)
	{
		users[u].socketId = socket.id
		console.log(`User:${user.username}::${user.socketId}`)
	}
	socket.emit("userUpdate", { user })
}

const handler = (io: Server, socket: Socket, rooms: Record<string, Room>, users: Record<string, User>) => {
	socket.on("createUserId", ({ username }) => {
		console.log(`createUserId::${username}`)
		const key = createRandomId()
		users[key] = { id: key, username, socketId: socket.id, ready: false }
		console.log(users)
		socketSendUserUpdate(socket, users, users[key])
		/*socket.emit("userUpdate", { user: users[key] })*/
		saveUsersToFile(users)
	})

	socket.on("getUserId", ({ id }) => {
		console.log(`getUserId::${id}`)
		if (!users[id]) {
			socket.emit("error", "UserNotFound")
			return
		}
		/*users[id].socketId = socket.id
		socket.emit("userUpdate", { user: users[id] })*/
		socketSendUserUpdate(socket, users, users[id])
		saveUsersToFile(users)
	})
}

export default handler;
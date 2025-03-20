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
	socket.on("createUserId", ({ username }: {username: string}) => {
		console.log(`createUserId::${username}`)
		const userEntry = Object.entries(users).find(u => u[1].username === username)
		if (userEntry) {
			const userSock = io.sockets.sockets.get(userEntry[1].socketId)
			if (userSock && userSock.connected) {
				return socket.emit("error", "Username already in use!")
			} else {
				users[userEntry[0]].socketId = socket.id
				users[userEntry[0]].ready = false
				socketSendUserUpdate(socket, users, users[userEntry[0]])
			}
		} else {
			const key = createRandomId()
			users[key] = { id: key, username, socketId: socket.id, ready: false }
			socketSendUserUpdate(socket, users, users[key])
		}
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
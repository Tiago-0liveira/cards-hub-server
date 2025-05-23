import { Server, Socket } from "socket.io";
import { cards_value_compare, cards_value_is_bigger, DECK, removeCards } from "./cards";
import { shuffleArray } from "../utils";
import { OlhoDonationType, PresidentPlayerState, PresidentPlayHandType, PresidentPosition, RoomStateBase, SoundName, Suit } from "../enums";
import { DEV, OLHO_QUICK_GAME } from "../config";

const presidentRooms: Record<string, PresidentRoom> = {}

export const olhoSocketHandler = (io: Server, socket: Socket, rooms: Record<string, Room>, users: Record<string, User>) => {

	socket.on("presidentRoomGetInfo", ({ id, userId }: { id: string, userId: string }) => {
		const user = rooms[id]?.players.find(u => u.id === userId)
		const userFromSocket = rooms[id]?.players.find(u => u.socketId === socket.id)
		if (user)
			console.log(`presidentRoomGetInfo::${user.username}::${user.id}`)
		else
			console.log(`presidentRoomGetInfo::Not found::${id}, userId:${userId}, socketId:${socket.id}}`)

		if (!presidentRooms[id])
		{
			console.log("Invalid presidentRoom id")
			socket.emit("goToLobby")
			return
		}
		if (presidentRooms[id].players.find(u => u.id === userId) === undefined)
		{
			socket.emit("goToLobby")
			return
		}
		if (presidentRooms[id].state === RoomStateBase.ONGOING && !presidentRooms[id].players.find(u => u.id === userId))
		{
			console.log("Invalid socket id")
			socket.emit("goToLobby");
			return
		}
		olhoRoomBroadcastUpdate(io, id, rooms, [])
	})

	socket.on("presidentRoomStartGame", ({ id }: { id: string }) => {
		console.log(`presidentRoomStartGame::${id}`)
		if (presidentRooms[id].players.length < 3)
		{
			socket.emit("error", "Not enough players to start, it is required a minimum of 3")
			return
		}
		if (!presidentRooms[id].players.every(user => user.ready))
		{
			socket.emit("error", "could not start the game, someone is not ready!")
			console.log(`ERROR::${id}::someone is not ready`)
			return
		}
		olhoRoomGameStarter(presidentRooms[id])
		rooms[id] = {...rooms[id], state: RoomStateBase.ONGOING}
		io.emit("rooms", rooms)

		olhoRoomBroadcastUpdate(io, id, rooms, [])
	})

	socket.on("presidentRoomPlayHand", ({roomId, userId, type, cards}: {roomId: string, userId: string, cards?: Card[], type: PresidentPlayHandType}) => {
		const lastHand = presidentRooms[roomId].currentHand[presidentRooms[roomId].currentHand.length - 1] ?? []
		const room = presidentRooms[roomId]
		const user = room.players.find(u => u.id === userId)
		const hand = presidentRooms[roomId].hands[userId]
		const audios: AudioCall[] = []
		let abafou = false
		if (!user || !hand)
		{
			socket.emit("error", "User or hand are undefined, please report this to dev")
			return
		}
		if (hand.state !== PresidentPlayerState.PLAYING)
		{
			socket.emit("error", "Stop messing with my code")
			return
		}
		if (type === PresidentPlayHandType.SKIP) {
			hand.state = PresidentPlayerState.WAITING
			const playersInGame = olhoGetPlayersInGame(room)
			room.lastPlayerAction = PresidentPlayHandType.SKIP
			if (playersInGame.length === 1) {
				olhoResetPlayerHands(room)
				let p: [string, PresidentPlayer] | null = null;
				if (room.winningPlayer !== "") {
					p = [room.winningPlayer, room.hands[room.winningPlayer]]
				} else {
					p = olhoGetNextPlayer(room, userId)
				}
				p[1].state = PresidentPlayerState.PLAYING
				room.winningPlayer = p[0]
				olhoPlayerSetState(p[1], PresidentPlayerState.PLAYING)

				room.roundNumber++
				room.handNumber = 0
				room.currentHand = []
				room.lastPlayer = ""
			} else {
				const [nPId, nextPlayer] = olhoGetNextPlayer(room, userId)
				hand.state = PresidentPlayerState.PASSED
				olhoPlayerSetState(nextPlayer, PresidentPlayerState.PLAYING)
			}
		} else if (type === PresidentPlayHandType.HAND) {
			room.lastPlayerAction = PresidentPlayHandType.HAND
			if (cards?.length === 0) {
				socket.emit("error", "Stop messing with the Api")
				return
			}
			const c = cards?.[0]
			if (!c)
			{
				socket.emit("error", "Stop messing with the Api")
				return
			}
			if (!cards?.every(ca => ca.value === c.value))
			{
				socket.emit("error", "Stop messing with the Api bro")
				return
			}
			const isCutting = cards.every(c => c.value === "2" || c.value === "JOKER")
			if (isCutting)
			{
				const [validCut, cutError] = olhoRoomHandCutValidCheck(lastHand, cards, room.roundNumber)
				if (!validCut && cutError !== "") {
					socket.emit("error", cutError)
					return
				}
				if (c.value === "JOKER") {
					room.roundNumber++
					room.handNumber = 0
					room.currentHand = []
					room.lastPlayer = ""
					room.lastPlayerAction = PresidentPlayHandType.JOKER
					hand.state = PresidentPlayerState.PLAYING
					audios.push({dest: "all", sound: SoundName.JOKER})
					olhoResetPlayerHands(room)
				}
			} else if (lastHand.length !== 0 && lastHand.length !== cards.length)
			{
				socket.emit("error", "You need to respect the last player's hand")
				return
			}
			if (!DEV || (DEV && !OLHO_QUICK_GAME))
			{
				if (room.roundNumber === 1 && lastHand.length === 0 && 
					!room.rankedGame && !cards.some(c => c.value === "3" && c.suit === Suit.CLUBS))
				{
					socket.emit("error", "In the first round you HAVE to play the 3 of clubs!")
					return
				}
			}
			if (lastHand.length !== 0)
			{
				if (lastHand[0].value === "7" && !isCutting && cards_value_is_bigger(c, lastHand[0])) {
					socket.emit("error", "You need to play lower/equal to 7 or cut")
					return
				} else if (lastHand[0].value !== "7" && cards_value_is_bigger(lastHand[0], c)) {
					socket.emit("error", "You need to play equal/above to lastHand or cut")
					return
				}
			}
			if (!isCutting && lastHand.length !== 0 && lastHand.every((c, i) => c.value === cards[i].value))
			{
				abafou = true
				audios.push({dest: "all", sound: SoundName.OLHO_ABAFADO})
			}
			room.winningPlayer = userId
			if (cards.every(c => c.value !== "JOKER"))
			{
				room.currentHand.push(cards)
				room.lastPlayer = userId
			}
			hand.hand = removeCards(hand.hand, cards)
		}
		if (hand.hand.length === 0)
		{
			hand.state = PresidentPlayerState.FINISHED
			hand.position = olhoGetNextPosition(room)
			if (olhoGetPlayersInGame(room).length === 0) {
				olhoResetPlayerHands(room)
			}
			const nextPlayer = olhoGetNextPlayer(room, userId, true)
			room.winningPlayer = nextPlayer[0]
			if (abafou) {
				const nextnextPlayer = olhoGetNextPlayer(room, nextPlayer[0])
				olhoPlayerSetState(nextnextPlayer[1], PresidentPlayerState.PLAYING)
				room.winningPlayer = nextnextPlayer[0]
			}
			else if (nextPlayer !== undefined)
			{
				olhoPlayerSetState(nextPlayer[1], PresidentPlayerState.PLAYING)
			}
		} else if (type !== PresidentPlayHandType.SKIP && (!cards ? true : cards.some(c => c.value !== "JOKER"))) {
			hand.state = PresidentPlayerState.WAITING
			const nextPlayer = olhoGetNextPlayer(room, userId)
			if (abafou) {
				const nextNextPlayer = olhoGetNextPlayer(room, nextPlayer[0])
				olhoPlayerSetState(nextNextPlayer[1], PresidentPlayerState.PLAYING)
			}
			else {
				olhoPlayerSetState(nextPlayer[1], PresidentPlayerState.PLAYING)
			}
		}
		room.handNumber++
		olhoRoomBroadcastUpdate(io, roomId, rooms, audios)
	})
}

const olhoRoomBroadcastUpdate = (io: Server, roomId: string, rooms: Record<string, Room>, audios: AudioCall[]) => {
	const room = presidentRooms[roomId];

	if (room === undefined) {
		console.error(`Room with ID ${roomId} does not exist.`);
		return;
	}
	if (room.state === RoomStateBase.ONGOING) {
		const lastPlayers = Object.entries(room.hands).filter(([id, hand]) => hand.hand.length !== 0)
		if (lastPlayers.length === 1)
		{
			const [_, lastPlayer] = lastPlayers[0]
			lastPlayer.position = PresidentPosition.OLHO
			lastPlayer.hand = []
			room.players.forEach(u => u.ready = false)
			room.state = RoomStateBase.IDLE
			rooms[room.id].state = RoomStateBase.IDLE
			room.rankedGame = true
			room.audioLogs = {}
			room.handNumber = 1
			room.winningPlayer = ""
			room.lastPlayer = ""
		}
	}
	if (room.handNumber === 1 && room.currentHand.length === 0) {
		room.audioLogs = {}
	}
	for (const player of room.players) {
		const playerSocket = io.sockets.sockets.get(player.socketId);
		if (!playerSocket) continue;

		// Clone the room data for safe modification
		// TODO: optimize this
		const roomData: PresidentRoom = JSON.parse(JSON.stringify(room));

		for (const [otherPlayerId, handData] of Object.entries(roomData.hands)) {
			handData.handSize = handData.hand.length
			if (otherPlayerId !== player.id) {
				roomData.hands[otherPlayerId].hand = []; // Clear hand for non-current players
			}
		}
		playerSocket.emit("presidentRoomInfo", { room: roomData });
		if (room.state === RoomStateBase.ONGOING) {
			for (const audio of audios) {
				if (audio.dest === "all" || audio.dest === player.id) {
					playerSocket.emit("play_audio", audio.sound)
				}
			}
			if (room.hands[player.id].state === PresidentPlayerState.PLAYING) {
				/* as this will be triggered every call if nothing changed we need to log the audioCall to the frontend */
				if (!room.audioLogs[player.id]) {
					room.audioLogs[player.id] = []
				}
				if (!room.audioLogs[player.id].find(log => log.handNumber === room.handNumber && log.sound === SoundName.READY_TO_PLAY)) {
					room.audioLogs[player.id].push({handNumber: room.handNumber, sound: SoundName.READY_TO_PLAY})
					playerSocket.emit("play_audio", SoundName.READY_TO_PLAY)
				}
			}
		}
	}
}

const olhoRoomHandCutValidCheck = (lastHand: Card[], hand: Card[], roundNumber: number): [boolean, string] => {
	if (roundNumber === 1) return [false, "Cannot cut in the first round!"]
	if (hand.some(c => c.value === "JOKER")) return [true, ""]

	if (lastHand.length === 1) return [true, ""]
	if (lastHand.length === 0 && hand.length > 1 && hand.some(c => c.value === "2"))
	{
		return [false, "You cannot cut with more than one 2 in the beginning of the round!"]
	}
	const lastHandIsCut = lastHand.some(c => c.value === "2")
	if (lastHandIsCut)
	{
		if (lastHand.length > hand.length)
			return [false, `To cut ${lastHand.length} 2's you need at least ${lastHand.length} 2's or a joker`]
		else
			return [true, ""]
	}
	else if (hand.length < lastHand.length - 1)
		return [false, "Invalid Cut"]

	return [true, ""]
}

export const olhoRoomGameStructInitializer = (room: Room) => {
	if (presidentRooms[room.id]) return

	presidentRooms[room.id] = {
		...room, hands: {}, currentHand: [], currentPlayer: "", winningPlayer: "",
		lastPlayer: "", lastPlayerAction: PresidentPlayHandType.HAND, roundNumber: 1,
		handNumber: 1, playerOrder: [], rankedGame: false, audioLogs: {}
	}
	presidentRooms[room.id].players.forEach(p => {
		p.ready = false
	});
}

export function olhoOnPlayerJoinRoom(io: Server, room: Room, rooms: Record<string, Room>, user: User) {
	const pPlayer = presidentRooms[room.id].hands[user.id]
	const pRoom = presidentRooms[room.id]
	if (pRoom)
	{
		const fp = pRoom.players.find(u => u.id === user.id)
		if (fp)/* atualizar socketId (pode ser uma nova) */
			fp.socketId = user.socketId
		else {
			pRoom.players.push(user)
		}
	}
	if (pPlayer !== undefined) {
		if (pPlayer.state === PresidentPlayerState.LEFTROOM) {
			pPlayer.state = pPlayer.lastState
			pPlayer.lastState = PresidentPlayerState.LEFTROOM
		}
	} else {
		pRoom.hands[user.id] = {
			hand: [], donations: [], handSize: 0,
			position: PresidentPosition.Neutral,
			state: PresidentPlayerState.WAITING,
			lastState: PresidentPlayerState.WAITING
		}
		if (pRoom.state !== RoomStateBase.ONGOING) {
			pRoom.playerOrder.push(user.id)
			if (pRoom.rankedGame) {
				olhoReorganizeRanks(pRoom, true, user.id)
			}
		}
		const p = pRoom.players.find(p => p.id === user.id)
		if (p)
			p.ready = false
	}

	/*io.to(room.id).emit("presidentRoomInfo", { room: pRoom })*/
	olhoRoomBroadcastUpdate(io, room.id, rooms, [])
}

export function olhoOnPlayerLeaveRoom(io: Server, room: Room, rooms: Record<string, Room>, user: User) {
	if (room.state === RoomStateBase.ONGOING)
	{
		if (presidentRooms[room.id].hands[user.id].state !== PresidentPlayerState.LEFTROOM)
		{
			presidentRooms[room.id].hands[user.id].lastState = presidentRooms[room.id].hands[user.id].state
			presidentRooms[room.id].hands[user.id].state = PresidentPlayerState.LEFTROOM
		}
	} else {
		presidentRooms[room.id].players = presidentRooms[room.id].players.filter(p => p.id !== user.id)
		if (presidentRooms[room.id].rankedGame) {
			olhoReorganizeRanks(presidentRooms[room.id], false, user.id)
		}
		presidentRooms[room.id].playerOrder = presidentRooms[room.id].playerOrder.filter(u => u !== user.id)
		delete presidentRooms[room.id].hands[user.id]
	}
	olhoRoomBroadcastUpdate(io, room.id, rooms, [])
}

export function olhoOnSetUserReady(io: Server, room: Room, userId: string, ready: boolean) {
	const p = presidentRooms[room.id].players.find(u => u.id === userId)
	if (p)
		p.ready = ready
	io.to(room.id).emit("presidentRoomInfo", { room: presidentRooms[room.id] })
}

export const olhoRoomGameStarter = (room: PresidentRoom) => {
	const hands = room.hands

	const shuffledDeck = [...DECK]
	for (let i = 0; i < Math.floor((Math.random() + 1) * 2); i++) {
		shuffleArray(shuffledDeck)
	}
	if (room.players.length === 0) return
	let x = 0;
	const rankedPlayers = Object.entries(hands).filter(([id, p]) => p.position !== PresidentPosition.Neutral)
	let startingId = ""
	room.rankedGame = rankedPlayers.length !== 0
	const cardDrawNum = !DEV ? shuffledDeck.length : OLHO_QUICK_GAME ? 16 : shuffledDeck.length
	for (let index = 0; index < cardDrawNum; index++)
	{
		if (x == room.players.length) x = 0;
		const player = room.players[x];
		if (!hands[player.id]) {hands[player.id] = {hand:[], donations: [], handSize: 0, position: PresidentPosition.Neutral, state: PresidentPlayerState.WAITING, lastState: PresidentPlayerState.WAITING}}
		else {
			hands[player.id].state = PresidentPlayerState.WAITING
		}
		hands[player.id].hand.push(shuffledDeck[index])
		if (DEV && OLHO_QUICK_GAME && index === 0)
		{
			hands[player.id].hand.push({value: "JOKER", suit: Suit.CLUBS})
		}
		if (!room.rankedGame && shuffledDeck[index].value === "3" && shuffledDeck[index].suit === Suit.CLUBS)
		{
			hands[player.id].state = PresidentPlayerState.PLAYING
			startingId = player.id
		}
		x++
	}
	if (!room.rankedGame && startingId === "") {
		startingId = room.players[0].id
	}

	if (rankedPlayers.length !== 0)
	{
		const president = rankedPlayers.find(([id, p]) => p.position === PresidentPosition.PRESIDENT)
		const olho = rankedPlayers.find(([id, p]) => p.position === PresidentPosition.OLHO)
		if (olho)
		{
			const olhoG = Object.entries(hands).find(([id, p]) => p.position === PresidentPosition.OLHO)
			if (olhoG)
			{
				startingId = olhoG[0]
			}
		}

		if (president && olho)
		{
			const presiCards = president[1].hand.slice().sort(cards_value_compare).slice(0, 2)
			const olhoCards = olho[1].hand.slice().sort(cards_value_compare).slice(-2)

			room.hands[president[0]].hand = removeCards(room.hands[president[0]].hand, presiCards)
			room.hands[president[0]].hand = room.hands[president[0]].hand.concat(olhoCards)
			room.hands[president[0]].donations = [
				{type: OlhoDonationType.INCOMING, cards: olhoCards},
				{type: OlhoDonationType.OUTGOING, cards: presiCards}
			]

			room.hands[olho[0]].hand = removeCards(room.hands[olho[0]].hand, olhoCards)
			room.hands[olho[0]].hand = room.hands[olho[0]].hand.concat(presiCards)
			room.hands[olho[0]].donations = [
				{type: OlhoDonationType.INCOMING, cards: presiCards},
				{type: OlhoDonationType.OUTGOING, cards: olhoCards},
			]

		}
		const vicepresident = rankedPlayers.find(([_, p]) => p.position === PresidentPosition.VICE_PRESIDENT)
		const viceolho = rankedPlayers.find(([_, p]) => p.position === PresidentPosition.VICE_OLHO)
		if (vicepresident && viceolho)
		{
			const vicepresiCards = vicepresident[1].hand.slice().sort(cards_value_compare).slice(0,1)
			const viceolhoCards = viceolho[1].hand.slice().sort(cards_value_compare).slice(-1)
			room.hands[vicepresident[0]].hand = removeCards(room.hands[vicepresident[0]].hand, vicepresiCards)
			room.hands[vicepresident[0]].hand = room.hands[vicepresident[0]].hand.concat(viceolhoCards)
			room.hands[vicepresident[0]].donations = [
				{type: OlhoDonationType.INCOMING, cards: viceolhoCards},
				{type: OlhoDonationType.OUTGOING, cards: vicepresiCards}
			]

			room.hands[viceolho[0]].hand = removeCards(room.hands[viceolho[0]].hand, viceolhoCards)
			room.hands[viceolho[0]].hand = room.hands[viceolho[0]].hand.concat(vicepresiCards)
			room.hands[viceolho[0]].donations = [
				{type: OlhoDonationType.OUTGOING, cards: viceolhoCards},
				{type: OlhoDonationType.INCOMING, cards: vicepresiCards}
			]
		}
	}

	hands[startingId].state = PresidentPlayerState.PLAYING

	presidentRooms[room.id] = {
		...room, hands, roundNumber: 1, winningPlayer: startingId,
		currentHand: [], state: RoomStateBase.ONGOING,
	}
}

const olhoGetNextPlayer = (room: PresidentRoom, userId: string, justInGame: boolean = false): [string, PresidentPlayer] => {
	const playerInGame = olhoGetPlayersInGame(room)
	if (playerInGame.length === 1) {
		if (playerInGame[0][0] !== userId)
			return [playerInGame[0][0], room.hands[playerInGame[0][0]]]
		return [userId, room.hands[userId]]
	}
	let Idx = room.playerOrder.indexOf(userId)
	let player: PresidentPlayer | undefined = undefined
	let pId: undefined | string = undefined
	do {
		Idx = (Idx + 1) % room.playerOrder.length
		pId = room.playerOrder[Idx]
		player = room.hands[pId]
	} while (player === undefined || (player.state === PresidentPlayerState.PASSED && !justInGame) ||
	player.state === PresidentPlayerState.FINISHED || player.hand.length === 0)
	return [pId, player]
}

const olhoGetNextPosition = (room: PresidentRoom): PresidentPosition => {
	const playersNum = room.players.length
	const playersLeft = Object.entries(room.hands).filter(([handId, hand]) => hand.hand.length > 0).length

	if (playersNum - playersLeft === 1) return PresidentPosition.PRESIDENT
	else if (playersNum - playersLeft === 2) {
		if (playersNum === 3)
			return PresidentPosition.Neutral
		return PresidentPosition.VICE_PRESIDENT
	}
	else if (playersLeft === 1) return PresidentPosition.VICE_OLHO
	else return PresidentPosition.Neutral
}

const olhoGetPlayersInGame = (room: PresidentRoom): [string, PresidentPlayer][] => {
	return Object.entries(room.hands).filter(([id, pp]) => pp.state === PresidentPlayerState.WAITING || (pp.state === PresidentPlayerState.LEFTROOM && pp.lastState === PresidentPlayerState.WAITING))
}

const olhoReorganizeRanks = (room: PresidentRoom, joined: boolean, new_user_id: string) => {
	const handsArr = Object.entries(room.hands)
	let ranksList = handsArr.sort((a,b) => b[1].position - a[1].position).filter(hand => hand[0] !== new_user_id)

	/* TODO: make this code cleaner */
	if (joined) {
		room.hands[new_user_id].position = PresidentPosition.OLHO;
		if (ranksList.length === 0) {
			room.hands[new_user_id].position = PresidentPosition.Neutral;
		}
		else if (ranksList.length === 1) {
			ranksList[0][1].position = PresidentPosition.PRESIDENT;
		}
		else if (ranksList.length === 2) {
			ranksList[0][1].position = PresidentPosition.Neutral;
		}
		else if (ranksList.length === 3) {
			ranksList[0][1].position = PresidentPosition.VICE_OLHO;
			ranksList[1][1].position = PresidentPosition.VICE_PRESIDENT;
		} else {
			/* subir todos os que estao abaixo de neutro para introduzir o novo a olho */
			for (let i = 0; i < ranksList.length; i++) {
				if (ranksList[i][1].position <= PresidentPosition.Neutral)
					break;
				ranksList[i][1].position--
			}
		}
	} else {
		const playerLeft = room.hands[new_user_id]
		if (ranksList.length === 1) {
			ranksList[0][1].position = PresidentPosition.Neutral;
		} else if (ranksList.length === 2) {
			ranksList[0][1].position = PresidentPosition.OLHO;
			ranksList[1][1].position = PresidentPosition.PRESIDENT;
		} else if (ranksList.length === 3) {
			ranksList[0][1].position = PresidentPosition.OLHO;
			ranksList[1][1].position = PresidentPosition.Neutral;
			ranksList[2][1].position = PresidentPosition.PRESIDENT;
		} else if (ranksList.length === 4) {
			ranksList[0][1].position = PresidentPosition.OLHO;
			ranksList[1][1].position = PresidentPosition.VICE_OLHO;
			ranksList[2][1].position = PresidentPosition.VICE_PRESIDENT;
			ranksList[3][1].position = PresidentPosition.PRESIDENT;
		} else {
			// More than 4 players: president, vice president, neutrals, vice-olho, olho
			ranksList[0][1].position = PresidentPosition.OLHO;
			ranksList[1][1].position = PresidentPosition.VICE_OLHO;

			for (let i = 2; i < ranksList.length - 2; i++) {
				ranksList[i][1].position = PresidentPosition.Neutral;
			}

			ranksList[ranksList.length - 2][1].position = PresidentPosition.VICE_PRESIDENT;
			ranksList[ranksList.length - 1][1].position = PresidentPosition.PRESIDENT;
		}
	}
}

const olhoPlayerSetState = (player: PresidentPlayer, state: PresidentPlayerState) => {
	if (player.state === PresidentPlayerState.LEFTROOM) {
		player.lastState = state;
	} else {
		player.state = state
	}
}

const olhoResetPlayerHands = (room: PresidentRoom) => {
	Object.keys(room.hands).forEach(id => {
		const hand = room.hands[id]
		if (hand.state < PresidentPlayerState.PLAYING)
			olhoPlayerSetState(hand, PresidentPlayerState.WAITING)
	})
}
import { PresidentPlayHandType, PresidentPosition, RoomStateBase, SoundName, Suit } from "./enums"

declare global {
	export type Room = {
		id: string;
		operator: string;
		players: User[];
		spectators: User[];
		name: string;
		type: number;
		state: RoomStateBase
	};
	
	export type User = {
		id: string,
		username: string,
		socketId: string,
		ready: boolean
	}
	
	export type NewRoomFormData = {
		user_id: string
		roomName: string;
		gameType: number;
	}
	
	export type DeleteRoomData = {
		id: string;
		userId: string
	}

	export type Card = {
		value: "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A" | "JOKER",
		suit: Suit | null
	}

	export type GameRoom = PresidentRoom

	export type OlhoDonation = {
		type: OlhoDonationType,
		cards: Card[]
	}

	export type PresidentPlayer = {
		hand: Card[],
		position: PresidentPosition,
		state: PresidentPlayerState,
		lastState: PresidentPlayerState,
		handSize: number,
		donations: OlhoDonation[]
	}

	export type PresidentRoom = Room & {
		hands: Record<string, PresidentPlayer>,
		currentHand: Card[][],
		lastPlayer: string,
		lastPlayerAction: PresidentPlayHandType
		currentPlayer: string,
		roundNumber: number,
		handNumber: number,
		playerOrder: string[],
		rankedGame: boolean,
		audioLogs: Record<string, SoundLog[]>
	}

	export type AudioCall = {
		dest: "all" | string,
		sound: SoundName
	}
	export type SoundLog = {
		sound: SoundName,
		handNumber: number
	}
}
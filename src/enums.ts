export enum RoomStateBase {
	IDLE, ONGOING
}

export enum GameType {
	OLHO = 2,
	NUM,
}

export enum Suit {
	DIAMONDS,
	CLUBS,
	HEARTS,
	SPADES
}

export enum PresidentPosition {
	PRESIDENT,
	VICE_PRESIDENT,
	Neutral,
	VICE_OLHO,
	OLHO
}

export enum PresidentPlayerState {
	PASSED, WAITING, PLAYING, FINISHED, LEFTROOM
}

export enum PresidentPlayHandType {
	SKIP, HAND, JOKER
}

export enum OlhoDonationType {
	OUTGOING, INCOMING
}

export enum SoundName {
	READY_TO_PLAY,
	OLHO_ABAFADO,
	JOKER,
}
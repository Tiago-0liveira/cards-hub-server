import { Suit } from "../enums";

const cardValues: Exclude<Card['value'], "JOKER">[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

const DECK: Card[] = [];

for (const suit in Suit) {
  if (isNaN(Number(suit))) {
    cardValues.forEach((value) => {
      DECK.push({ value, suit: Suit[suit as keyof typeof Suit] });
    });
  }
}

DECK.push({ value: "JOKER", suit: Suit.CLUBS });
DECK.push({ value: "JOKER", suit: Suit.DIAMONDS });

const OLHO_CARDS_VALUE_ARRAY = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2", "JOKER"]
export const cards_value_compare = (a: Card, b: Card): number => (
	OLHO_CARDS_VALUE_ARRAY.indexOf(a.value) - OLHO_CARDS_VALUE_ARRAY.indexOf(b.value)
)

export const cards_value_is_bigger = (a: Card, b: Card): boolean => (
	OLHO_CARDS_VALUE_ARRAY.indexOf(a.value) > OLHO_CARDS_VALUE_ARRAY.indexOf(b.value)
)

export const cards_value_is_eq_or_bigger = (a: Card, b: Card): boolean => {
	console.log(a.value, b.value, OLHO_CARDS_VALUE_ARRAY.indexOf(a.value), OLHO_CARDS_VALUE_ARRAY.indexOf(b.value))

	return OLHO_CARDS_VALUE_ARRAY.indexOf(a.value) >= OLHO_CARDS_VALUE_ARRAY.indexOf(b.value)
}

export const isCardEqual = (card1: Card, card2: Card): boolean => {
    return card1.value === card2.value && card1.suit === card2.suit;
}

export const removeCards = (deck: Card[], cardsToRemove: Card[]): Card[] => {
	return deck.filter(card => !cardsToRemove.some(cardToRemove => isCardEqual(card, cardToRemove)))
}

export { DECK }
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
const DEV = process.env.NODE_ENV === "development"

const OLHO_QUICK_GAME = true

console.log(process.env.NODE_ENV)

console.log("DEV:", DEV)
console.log("OLHO_QUICK_GAME:", OLHO_QUICK_GAME)

export { 
	PORT, DEV,
	OLHO_QUICK_GAME
}
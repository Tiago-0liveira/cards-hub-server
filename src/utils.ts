import { v4 } from "uuid"
import fs from "fs"

export const createRandomId = (): string => {
	return v4()
}

export const saveUsersToFile = (users: Record<string, User>, file: string = "users.json") => {
	if (!file.endsWith(".json"))
		file += ".json"
	fs.writeFileSync(file, JSON.stringify(users))
}

export const readUsersFromFile = (file: string = "users.json"): Record<string, User> => {
	try {
		const content = fs.readFileSync(file, "utf-8")
		return JSON.parse(content)
	} catch (error) {
		return {}
	}
}

function shuffleArray<T>(array: T[]): T[] {
	for (let i = array.length - 1; i > 0; i--) {
	  const j = Math.floor(Math.random() * (i + 1));
	  [array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

export { shuffleArray }
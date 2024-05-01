const { SlashCommandBuilder } = require('discord.js');

class Player {
	constructor(clientObj) {
		this.numDice = 2;
		this.dice = [];
		this.clientObj = clientObj;
	}

	rollDice() {
		return Math.floor(Math.random() * 6) + 1;
	}

	rollDiceSet() {
		this.dice = [];
		for (let i = 0; i < this.numDice; i++) {
			this.dice.push(this.rollDice());
		}
	}
}
class Game {
	constructor(clientObj, opponentObj) {
		// Init players
		this.currentPlayer = new Player(clientObj);
		this.nonCurrentPlayer = new Player(opponentObj);

		this.gameOver = false;
		this.roundOver = false;

		// Store game information
		this.updateTotalDice();
		this.currentBid = 10;
		this.updatedBid = this.currentBid;
	}
	updateTotalDice() {
		this.totalDice = this.currentPlayer.numDice + this.nonCurrentPlayer.numDice;
	}
	swapCurrentPlayer() {
		let temp = this.currentPlayer;
		this.currentPlayer = this.nonCurrentPlayer;
		this.nonCurrentPlayer = temp;
	}
	rollDice() {
		this.currentPlayer.rollDiceSet();
		this.nonCurrentPlayer.rollDiceSet();
	}
	async sendDiceInfo() {
		await this.currentPlayer.clientObj.send(`Your dice: ${mapIntsToEmojis(this.currentPlayer.dice).join('')}\nTotal Dice: ${this.totalDice}\nCurrent Bet: ${this.currentBid}$`);
		await this.nonCurrentPlayer.clientObj.send(`Your dice: ${mapIntsToEmojis(this.nonCurrentPlayer.dice).join('')}\nTotal Dice: ${this.totalDice}\nCurrent Bet: ${this.currentBid}$`);
	}
}

async function sendMessage(text, choices, client) {
	const message = await client.send(text);

	const emojiChoices = mapIntsToEmojis(choices);
	for (const choice of emojiChoices) {
		await message.react(choice);
	}

	return new Promise((resolve, reject) => {
		const collectorFilter = (reaction, user) => {
			return emojiChoices.includes(reaction.emoji.name) && user.id !== message.author.id
		};

		const collector = message.createReactionCollector({ filter: collectorFilter, max: 1 });

		collector.on('collect', (reaction) => {
			const int = mapEmojiToInt(reaction.emoji.name);
			resolve(int);
			collector.stop();
		});

		collector.on('end', (collected, reason) => {
			if (reason === 'time') {
				reject(new Error('Reaction selection timed out'));
			}
		});
	});
}
async function handleTurn(game, lastDieBidOn, lastOccurrenceOfDie) {
	let text = 'Do you want to double?:\n' +
		':one: Yes\n' +
		':two: No\n';

	let choices = range(1, 3);
	let choice = await sendMessage(text, choices, game.currentPlayer.clientObj);

	const doubleBool = (choice === 1) ? true : false;


	text = 'It\'s your turn!:\n' +		// add call bluff option when apropriate
		':one: Bid\n' +
		':two: Call Bluff\n' +
		':three: Fold';
	choices = range(1, 4);
	choice = await sendMessage(text, choices, game.currentPlayer.clientObj);


	if (choice === 1) { // BID
		const [dieBidOn, occurrenceOfDie] = await bid(game.currentPlayer.clientObj, lastDieBidOn, lastOccurrenceOfDie, game.totalDice);
		return [dieBidOn, occurrenceOfDie, "bid", doubleBool]

	} else if (choice === 2) { // CALL BLUFF
		bluffSuccess = callBluff(game, lastDieBidOn, lastOccurrenceOfDie);
		return [0, 0, bluffSuccess ? "bluffFail" : "bluffSuccess", doubleBool]

	} else if (choice === 3) { // FOLD
		return [0, 0, "fold", doubleBool]
	}
}
function callBluff(game, dieBidOn, guessedOccurrenceOfDie) {
	const occurrences = {};

	game.currentPlayer.dice.forEach(num => {
		occurrences[num] = (occurrences[num] || 0) + 1;
	});
	game.nonCurrentPlayer.dice.forEach(num => {
		occurrences[num] = (occurrences[num] || 0) + 1;
	});

	let occurrencesOfDieBidOn = occurrences[dieBidOn];
	if (dieBidOn != 1 && occurrences[1]) {
		occurrencesOfDieBidOn += occurrences[1];
	}
	return occurrencesOfDieBidOn >= guessedOccurrenceOfDie;
}
async function bid(client, lastDieBidOn, lastOccurrenceOfDie, totalDice) {
	let text = 'What die do you want to bid on?'
	let choices = range(1, 7);

	const dieBidOn = await sendMessage(text, choices, client)
	const x = (lastDieBidOn && lastDieBidOn >= dieBidOn) ? 1 : 0;

	text = `How many occurrence of ${dieBidOn}?`
	choices = range(lastOccurrenceOfDie + x, totalDice + 1);

	const occurrenceOfDie = await sendMessage(text, choices, client)

	return [dieBidOn, occurrenceOfDie]
}

function mapIntsToEmojis(integers) {
	const emojiMap = {
		1: '1️⃣',
		2: '2️⃣',
		3: '3️⃣',
		4: '4️⃣',
		5: '5️⃣',
		6: '6️⃣',
		7: '7️⃣',
		8: '8️⃣',
		9: '9️⃣',
		10: '🔟'
	};
	return integers.map(number => emojiMap[number]);
}
function mapEmojiToInt(emoji) {
	const emojiMap = {
		'1️⃣': 1,
		'2️⃣': 2,
		'3️⃣': 3,
		'4️⃣': 4,
		'5️⃣': 5,
		'6️⃣': 6,
		'7️⃣': 7,
		'8️⃣': 8,
		'9️⃣': 9,
		'🔟': 10
	};
	return emojiMap[emoji]
}
function range(start, end, step = 1) {
	const result = [];
	for (let i = start; i < end; i += step) {
		result.push(i);
	}
	return result;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('play_liars_dice')
		.setDescription('Play Liars Dice against another player.')
		.addStringOption(option =>
			option.setName('opponent_id')
				.setDescription('The ClientID of the person you want to play against')
				.setRequired(true)),

	async execute(interaction, client) {
		const clientObj = await client.users.fetch(interaction.user.id);
		const opponentObj = await client.users.fetch(interaction.options.getString('opponent_id'));

		const game = new Game(clientObj, opponentObj);

		while (!game.gameOver) {
			game.rollDice();
			game.updateTotalDice();

			await game.sendDiceInfo()

			let dieBidOn = 0;
			let occurrenceOfDie = 1;

			game.roundOver = false;

			while (!game.roundOver) {
				[dieBidOn, occurrenceOfDie, action, doubleBool] = await handleTurn(game, dieBidOn, occurrenceOfDie, game.totalDice);

				action !== "fold" ? game.currentBid = game.updatedBid : null;

				if (doubleBool) {
					game.updatedBid *= 2;
					await game.nonCurrentPlayer.clientObj.send(`${game.currentPlayer.clientObj.username} doubled the bet to ${game.updatedBid}$`);
				}

				switch (action) {
					case "bid":
						await game.nonCurrentPlayer.clientObj.send(`${game.currentPlayer.clientObj.username} bid on ${occurrenceOfDie} ${dieBidOn}s`);
						break;

					case "fold":
						await game.currentPlayer.clientObj.send(`You folded and lost ${game.currentBid}$`);
						await game.nonCurrentPlayer.clientObj.send(`${game.currentPlayer.clientObj.username} folded you win ${game.currentBid}$`);
						game.roundOver = true;
						game.gameOver = true;
						break;
					
					case "bluffSuccess":
					case "bluffFail":
						const bluffSuccess = action === "bluffSuccess";
						const playerLost = bluffSuccess ? game.nonCurrentPlayer : game.currentPlayer;
						const playerWon = bluffSuccess ? game.currentPlayer : game.nonCurrentPlayer;

						if (bluffSuccess) {
							await game.currentPlayer.clientObj.send(`${game.nonCurrentPlayer.clientObj.username} was bluffing, they lost a die`);
							await game.nonCurrentPlayer.clientObj.send(`${game.currentPlayer.clientObj.username} called your bluff,  you lost a die`);
						}
						else {
							await game.currentPlayer.clientObj.send(`${game.nonCurrentPlayer.clientObj.username} wasn't bluffing, you lost a die`);
							await game.nonCurrentPlayer.clientObj.send(`${game.currentPlayer.clientObj.username} called your bluff, they lost a die`);
						}
						playerLost.numDice--;
					
						if (playerLost.numDice === 0) {
							await playerWon.clientObj.send(`${playerLost.clientObj.username} lost all their dice. You won ${game.currentBid}$`);
							await playerLost.clientObj.send(`You lost all your dice. You lose ${game.currentBid}$.`);
							game.gameOver = true;
						}
					
						game.roundOver = true;
						if (!bluffSuccess) {
							game.swapCurrentPlayer();
						}
						break;

				}

				game.swapCurrentPlayer();
			}

		}

	}
}



// stop letting call bluff on first move
// decide wether and handle doubling on a bluffFail/Success
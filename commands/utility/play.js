const { SlashCommandBuilder } = require('discord.js');

class Player {
	constructor(clientObj) {
		this.numDice = 5;
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
		this.player1 = new Player(clientObj);
		this.player2 = new Player(opponentObj);

		// Store current player and game over state
		this.currentPlayer = this.player1;
		this.nonCurrentPlayer = this.player2;
		this.gameOver = false;
		this.roundOver = false;

		// Store game information
		this.updateTotalDice();
		this.currentBid = 10;
		this.updatedBid = this.currentBid;
	}
	updateTotalDice() {
		this.totalDice = this.player1.numDice + this.player2.numDice;
	}
	swapCurrentPlayer() {
		let temp = this.currentPlayer;
		this.currentPlayer = this.nonCurrentPlayer;
		this.nonCurrentPlayer = temp;
	}
	rollDice() {
		this.player1.rollDiceSet();
		this.player2.rollDiceSet();
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


	text = 'It\'s your turn! React to choose an action:\n' +		// add call bluff option when apropriate
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

	game.player1.dice.forEach(num => {
		occurrences[num] = (occurrences[num] || 0) + 1;
	});
	game.player2.dice.forEach(num => {
		occurrences[num] = (occurrences[num] || 0) + 1;
	});
	console.log(occurrences);
	let occurrencesOfDieBidOn = occurrences[dieBidOn];
	if (dieBidOn != 1) {
		occurrencesOfDieBidOn += occurrences[1];
	}
	console.log(occurrencesOfDieBidOn, guessedOccurrenceOfDie)
	return occurrencesOfDieBidOn >= guessedOccurrenceOfDie;
}

async function bid(client, lastDieBidOn, lastOccurrenceOfDie, totalDice) {
	let text = 'What die do you want to bid on?'
	let choices = range(1, 7);

	const dieBidOn = await sendMessage(text, choices, client)
	console.log(lastDieBidOn, dieBidOn);
	const x = (lastDieBidOn && lastDieBidOn >= dieBidOn) ? 1 : 0;

	console.log(x);
	text = `How many occurrence of ${dieBidOn}?`
	choices = range(lastOccurrenceOfDie + x, totalDice + 1);

	const occurrenceOfDie = await sendMessage(text, choices, client)

	return [dieBidOn, occurrenceOfDie]
}
async function sendDiceInfo(player, game) {
	await player.clientObj.send(`Your dice: ${mapIntsToEmojis(player.dice).join('')}\nTotal Dice: ${game.totalDice}\nCurrent Bet: ${game.currentBid}$`);
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

			await sendDiceInfo(game.player1, game);
			await sendDiceInfo(game.player2, game);


			let dieBidOn = 0;
			let occurrenceOfDie = 1;

			game.roundOver = false;

			while (!game.roundOver) {
				const result = await handleTurn(game, dieBidOn, occurrenceOfDie, game.totalDice);

				console.log(result);

				dieBidOn = result[0];
				occurrenceOfDie = result[1];
				gameState = result[2];
				doubleBool = result[3];

				console.log(gameState);

				if (gameState !== "fold") {
					game.currentBid = game.updatedBid;
					console.log(game.currentBid);
				}

				if (doubleBool) {
					game.updatedBid *= 2;
					await game.nonCurrentPlayer.clientObj.send(`${game.currentPlayer.clientObj.username} doubled the bet to ${game.updatedBid}$`);
				}

				if (gameState === "bid") {
					game.swapCurrentPlayer();
					await game.currentPlayer.clientObj.send(`${game.nonCurrentPlayer.clientObj.username} bid on ${occurrenceOfDie} ${dieBidOn}s`);
				}
				else if (gameState === "bluffSuccess") {
					game.swapCurrentPlayer();
					await game.nonCurrentPlayer.clientObj.send(`${game.currentPlayer.clientObj.username} lost a die`);
					await game.currentPlayer.clientObj.send(`${game.nonCurrentPlayer.clientObj.username} called your bluff. You lost a die`);
					game.currentPlayer.numDice--;

					if (game.currentPlayer.numDice === 0) {
						await game.nonCurrentPlayer.clientObj.send(`${game.nonCurrentPlayer.clientObj.username} lost all there die. You won!`);
						await game.currentPlayer.clientObj.send(`You lost all your dice you lose.`);
					}
					game.roundOver = true;
				}
				else if (gameState === "bluffFail") {
					await game.currentPlayer.clientObj.send(`${game.nonCurrentPlayer.clientObj.username} wasnt bluffing you lost a die`);
					await game.nonCurrentPlayer.clientObj.send(`${game.currentPlayer.clientObj.username} called your bluff. They lost a die`);
					game.currentPlayer.numDice--;
					
					if (game.currentPlayer.numDice === 0) {
						await game.nonCurrentPlayer.clientObj.send(`${game.nonCurrentPlayer.clientObj.username} lost all there die. You won!`);
						await game.currentPlayer.clientObj.send(`You lost all your dice you lose.`);
					}
					game.roundOver = true;
				}
				else if (gameState === "fold") {
					game.swapCurrentPlayer();
					await game.nonCurrentPlayer.clientObj.send(`You folded and lost ${game.currentBid}$`);
					await game.currentPlayer.clientObj.send(`${game.nonCurrentPlayer.clientObj.username} folded you win ${game.currentBid}$`);
					game.roundOver = true;
					game.gameOver = true;
				}

			}

		}

	}
}
// Deprecated features:
// game.player1 and game.player2



// end game once either player is out of dice
// make the main part use a switch instead of else if
// stop letting call bluff on first move
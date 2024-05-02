
import { SlashCommandBuilder, ChatInputCommandInteraction, Client, ButtonBuilder, ActionRowBuilder, User, ButtonStyle, Message } from 'discord.js';


class Player {
    numDice: number;
    dice: number[];
    clientObj: User;

    constructor(clientObj: User) {
        this.numDice = 5;
        this.dice = [];
        this.clientObj = clientObj;
    }

    rollDice(): number {
        return Math.floor(Math.random() * 6) + 1;
    }

    rollDiceSet(): void {
        this.dice = [];
        for (let i = 0; i < this.numDice; i++) {
            this.dice.push(this.rollDice());
        }
    }
}
class Game {
    currentPlayer: Player;
    nonCurrentPlayer: Player;
    gameOver: boolean;
    roundOver: boolean;
    totalDice: number;
    currentBid: number;
    updatedBid: number;

    constructor(clientObj: any, opponentObj: any) {
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

    updateTotalDice(): void {
        this.totalDice = this.currentPlayer.numDice + this.nonCurrentPlayer.numDice;
    }

    swapCurrentPlayer(): void {
        let temp = this.currentPlayer;
        this.currentPlayer = this.nonCurrentPlayer;
        this.nonCurrentPlayer = temp;
    }

    rollDice(): void {
        this.currentPlayer.rollDiceSet();
        this.nonCurrentPlayer.rollDiceSet();
    }

    async sendDiceInfo(): Promise<void> {
        await this.currentPlayer.clientObj.send(`Your dice: ${mapIntsToEmojis(this.currentPlayer.dice).join('')}\nTotal Dice: ${this.totalDice}\nCurrent Bet: ${this.currentBid}$`);
        await this.nonCurrentPlayer.clientObj.send(`Your dice: ${mapIntsToEmojis(this.nonCurrentPlayer.dice).join('')}\nTotal Dice: ${this.totalDice}\nCurrent Bet: ${this.currentBid}$`);
    }
}

async function getAction(
    message: [string, string[]], 
    currentPlayerObj: User
): Promise<string> {

    let buttonsList: ActionRowBuilder<any>[] = [];
    let currentRow: ActionRowBuilder<any> = new ActionRowBuilder();
    let buttonCount: number = 0;
    
    for (let option of message[1]) {
        let button = new ButtonBuilder()
            .setCustomId(option)
            .setLabel(option)
            .setStyle(ButtonStyle.Primary);
    
        currentRow.addComponents(button);
        buttonCount++;
    
        if (buttonCount >= 5) {
            buttonsList.push(currentRow);
            currentRow = new ActionRowBuilder();
            buttonCount = 0;
        }
    }
    
    if (buttonCount > 0) {
        buttonsList.push(currentRow);
    }

    const builtMessage: Message = await currentPlayerObj.send({
        content: message[0],
        components: buttonsList,
    })

    const buttonPressed: string = (await builtMessage.awaitMessageComponent()).customId;
    builtMessage.delete()
    return buttonPressed

}
async function handleTurn(
    game: Game, 
    lastDieBidOn: number, 
    lastOccurrenceOfDie: number, 
): Promise<(number | string | boolean)[] | undefined> {

    let message: [string, string[]] = ['Do you want to double?', ['Yes', 'No']]
    let action: string = await getAction(message, game.currentPlayer.clientObj)
    const doubleBool: boolean = action === "Yes";

    message = ['It is your turn!', ['Bid', 'Call Bluff', 'Fold']]
    action = await getAction(message, game.currentPlayer.clientObj)

    switch (action) {
        case "Bid":
            const [dieBidOn, occurrenceOfDie] = await bid(game.currentPlayer.clientObj, lastDieBidOn, lastOccurrenceOfDie, game.totalDice);
            return [dieBidOn, occurrenceOfDie, "bid", doubleBool]

        case "Call Bluff":
            const bluffSuccess = callBluff(game, lastDieBidOn, lastOccurrenceOfDie);
            return [0, 0, bluffSuccess ? "bluffFail" : "bluffSuccess", doubleBool]

        case "Fold":
            return [0, 0, "fold", doubleBool]

        default:
            return undefined;
        
    }
}
async function bid(
    currentPlayerObj: User,
    lastDieBidOn: number,
    lastOccurrenceOfDie: number,
    totalDice: number
): Promise<[number, number]> {

    let message: [string, string[]] = ['What die do you want to bid on?', range(1,7)]
    const dieBidOn: number = parseInt(await getAction(message, currentPlayerObj))
    const x = (lastDieBidOn && lastDieBidOn >= dieBidOn) ? 1 : 0;
    message = [`How many occurrence of ${dieBidOn}?`, range(lastOccurrenceOfDie+x, totalDice+1)];
    const occurrenceOfDie = parseInt(await getAction(message, currentPlayerObj));

    return [dieBidOn, occurrenceOfDie]
}
function callBluff(
    game: Game, 
    dieBidOn: number, 
    guessedOccurrenceOfDie: number
): boolean {
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
function mapIntsToEmojis(integers: number[]): string[] {
    const emojiMap: { [key: number]: string } = {
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
function range(
    start: number, 
    end: number, 
    step: number = 1
): string[] {

    const result: string[] = [];
    for (let i: number = start; i < end; i += step) {
        result.push(i.toString());
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

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const clientObj: User = await client.users.fetch(interaction.user.id);

        const opponentId: string | null = interaction.options.getString('opponent_id');
        if (!opponentId) throw new Error('Opponent ID is null or undefined.');
        const opponentObj: User = await client.users.fetch(opponentId);

        const game: Game = new Game(clientObj, opponentObj);

		while (!game.gameOver) {
			game.rollDice();
			game.updateTotalDice();

			await game.sendDiceInfo()

			let dieBidOn: number = 0;
			let occurrenceOfDie: number = 1;
            let action: string = "";
            let doubleBool: boolean = false;

			game.roundOver = false;

			while (!game.roundOver) {
                const results = await handleTurn(game, dieBidOn, occurrenceOfDie);

                [dieBidOn, occurrenceOfDie, action, doubleBool] = results as [number, number, string, boolean];
                
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


const config = require('../config/config')

const generateHelpMessage = async () => {
    const setup = {"name": '**-----Setting up-----**', 
    "value": `For a **fresh** channel, use **!track** in the channel you want to use for counting\n` +
             `For channels with some counts already, use **!setup** in the channel instead (may take a while)\n` +
             `Note that for existing setup up you may be prompted to accept or deny certain counts in the channel`}
    const basicDiv = {"name": '**-----Basic Usage-----**', "value": "How to count - Type in the number, or a simple equation that adds up to the number. If it is accepted, Count Bot will react with ✅"}
    const basicCommands = [
        ['count', 'Shows the current count'],
        ['me', 'Shows how many times you have counted'],
        ['latest', 'Gets list of the latest counters and how long it\'s been since their last count'],
        ['earliest', 'Gets list of the earliest counters and how long it\'s been since their first count'],
        ['plot [my|all] [month|day|hour]', 'Plots a graph of (your or the whole server\'s) counts grouped by month, day of the week, or hour of the day'],
        ['rank [month|date|all(default)] [MM/YYYY|MM/DD/YYYY]', 'Gets a list of rankings of all time by default, or with arguments you can rankings of specific months or dates'],
        ['review [count_number]', 'Outputs details of the message that was sent for a specified count'],
        ['money', 'Shows how much money you have (Count to get more)'],
        ['flip [heads|tails] [bet]', 'Bet money on a coin flip'],
        ['dice [2-12] [bet]', 'Bet money on a double dice roll, payout multiplier is the inverse of the odds'],
    ]
    const adminDiv = {"name": '**-----Admin Commands-----**', "value": "Commands available only to the owner of the server"}
    const adminCommands = [
        ['setup', 'Should only be used for channels that already have counts in them. This allows you to start tracking from whatever number you\'re currently at.\nNote: It may take awhile and may ask you to verify some counts'],
        ['track', 'Enable counting in a channel'],
        ['untrack', 'Disable counting in a channel (will ask for confirmation)'],
        ['cleanmessages', 'Should be used ONCE after setting up a new channel with the setup command']
    ]
    let embed = {}
    embed.title = '***Count Bot Help***'
    embed.color = 1535999
    embed.fields = []
    embed.fields.push(setup)
    embed.fields.push(basicDiv)
    basicCommands.forEach((command) => {
        embed.fields.push({"name": `**${config.PREFIX}${command[0]}**`, "value": command[1]})
    })
    embed.fields.push(adminDiv)
    adminCommands.forEach((command) => {
        embed.fields.push({"name": `**${config.PREFIX}${command[0]}**`, "value": command[1]})
    })
    return {embed}
}

module.exports = {generateHelpMessage}
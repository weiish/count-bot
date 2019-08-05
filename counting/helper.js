const Discord = require("discord.js")

const isValidUserID = async (guild, user_id) => {
    try {
        const guildMember = await guild.fetchMember(user_id)
        if (guildMember.id) {
            return true
        }
    } catch (e) {
        return false
    }
}

module.exports = {
    isValidUserID
}
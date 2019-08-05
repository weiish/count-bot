const { connection, query } = require("../database/db");

const incrementUserNonCountMessages = async (server_id, channel_id, user_id) => {
    const non_count_messages = await getUserNonCountMessages(server_id, channel_id, user_id)
    if (non_count_messages) {
        try {
            await query(`UPDATE users SET non_count_messages = non_count_messages + 1 WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND user_id = ${user_id}`)            
            return true
        } catch (e) {
            return false
        }
    } else {
        const result = await insertUserNonCountMessages(server_id, channel_id, user_id)
        return result
    }
}

const getUserNonCountMessages = async (server_id, channel_id, user_id) => {
    const myquery = `SELECT * FROM users WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND user_id = ${user_id}`
    const result = await query(`SELECT * FROM users WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND user_id = ${user_id}`)
    if (result.length > 0) {
        return result[0].non_count_messages
    } else {
        return
    }
}

const insertUserNonCountMessages = async (server_id, channel_id, user_id) => {
    try {
        let non_count_messages = 1
        await query(`INSERT INTO users SET ?`, {server_id, channel_id, user_id, non_count_messages})
        return true
    } catch (e) {
        console.log(e)
        return false
    }
}

const resetUserNonCountMessages = async (server_id, channel_id, user_id) => {
    const non_count_messages = await getUserNonCountMessages(server_id, channel_id, user_id)
    if (non_count_messages) {
        try {
            await query(`UPDATE users SET non_count_messages = 1 WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND user_id = ${user_id}`)
            return true
        } catch (e) {
            console.log('Error resetting User Non Count Messages')
            return false
        }
    } else {
        const result = await insertUserNonCountMessages(server_id, channel_id, user_id)
        return true
    }
}

module.exports = {
    incrementUserNonCountMessages,
    getUserNonCountMessages,
    insertUserNonCountMessages, 
    resetUserNonCountMessages
}
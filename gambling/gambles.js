const { connection, query } = require("../database/db");

const logGamble = async(user_id, amount, type, won, guess) => {            
    try {        
        await query(`INSERT INTO gambles SET ?`, {user_id, amount, type, won, guess})
        return true
    } catch (e) {
        console.log(e)
        return false
    }
}

module.exports = {
    logGamble
}
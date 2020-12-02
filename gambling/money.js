const { connection, query } = require("../database/db");

const getMoney = async(user_id) => {        
    const result = await query(`SELECT money FROM money WHERE user_id = ${user_id}`)
    if (result.length > 0) {
        return result[0].money
    } else {
        return null;
    }
}

const addMoney = async(user_id, money = 0) => {
    const currentMoney = await getMoney(user_id)
    if (currentMoney != null || currentMoney === 0) {
        try {
            await query(`UPDATE money SET money = money + ${money} WHERE user_id = ${user_id}`)            
            return true
        } catch (e) {
            return false
        }
    } else {
        const result = await insertMoney(user_id, money)
        return result        
    }    
}

const insertMoney = async(user_id, money = 0) => {
    try {
        await query(`INSERT INTO money SET ?`, {user_id, money})
        return true
    } catch(e) {
        console.log(e)
        return false
    }
}

module.exports = {
    getMoney,
    addMoney,
    insertMoney
}
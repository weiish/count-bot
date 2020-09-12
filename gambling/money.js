const { connection, query } = require("../database/db");

const getMoney = async(user_id) => {        
    const result = await query(`SELECT money FROM money WHERE user_id = ${user_id}`)
    if (result.length > 0) {
        return result[0].money
    } else {
        return
    }
}

const addMoney = async(user_id, amount = 0) => {
    const money = await getMoney(user_id)
    if (money) {
        try {
            await query(`UPDATE money SET money = money + ${amount} WHERE user_id = ${user_id}`)            
            return true
        } catch (e) {
            return false
        }
    } else {
        const result = await insertMoney(user_id, amount)
        return result        
    }    
}

const insertMoney = async(user_id, amount = 0) => {
    try {
        await query(`INSERT INTO money SET ?`, {user_id, amount})
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
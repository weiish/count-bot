const { connection, query } = require("../database/db");
const keys = require("../config/keys");

let loadedAdmins = false;

const isCreator = (user_id) => {
    return user_id === keys.CREATOR_ID
}

const addAdmin = async (admins, server_id, user_id, permissions) => {
    let isAdmin = await isAdminDB(server_id, user_id);
    if (isAdmin) {
        return 'That user is already an admin of this server, silly'
    }
    //ADD ADMIN TO DB
    try {
      await query('INSERT INTO admins SET ?', {server_id, user_id, permissions})
      if (server_id in admins) {
        admins[server_id].push(user_id)
      } else {
          admins[server_id] = [user_id]
      }
      
      return `<@${user_id}> added to admin list for this server`
    } catch (e) {
        console.log(e)
      return `There was an error adding that user to the server :(`
    }
  };
  
  const remAdmin = async (admins, server_id, user_id) => {
    //REMOVE ADMIN FROM DB
    try {
        await query(`DELETE FROM admins WHERE server_id = ${server_id} AND user_id = ${user_id}`)
        admins[server_id].splice(admins[server_id].indexOf(user_id),1);
        return `<@${user_id}> removed from the admin list for this server`
      } catch (e) {
        console.log(e)
        return `There was an error removing that user from the server :(`
      }
  };

  const loadAdmins = async () => {
    try {
        let admins = await query(`SELECT * FROM admins`);
        let adminsObj = {};
        for (let i = 0; i < admins.length; i++) {
            let admin = admins[i];
            let key = admin.server_id;
            if (key in adminsObj) {
                adminsObj[key].push(admin.user_id);
            } else {
                adminsObj[key] = [admin.user_id];
            }
        }
        console.log('Loaded admins!')
        return adminsObj
    } catch (e) {
        return false
    }
  }
  const isAdminLocal = async (admins, server_id, user_id) => {

    if (keys.ADMIN_IDS.includes(user_id)) return true;

    try {
        if (admins[server_id].includes(user_id)) {
            //TODO: Return permissions levels if needed instead of boolean
            return true
        }
    } catch (e) {
        return false
    }
    return false
}

  const isAdminDB = async (server_id, user_id) => {
      if (keys.ADMIN_IDS.includes(user_id)) return true;
  
      let admin_ids = await query(`SELECT permissions FROM admins WHERE server_id = ${server_id} AND user_id = ${user_id}`)
      if (admin_ids.length > 0) {
          //TODO: Return permissions levels if needed instead of boolean
          return true
      }
      return false
  }

  module.exports = {
      isCreator,
      addAdmin,
      remAdmin,
      loadAdmins,
      loadedAdmins,
      isAdminLocal,
      isAdminDB
  }
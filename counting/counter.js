const { connection, query } = require("../database/db");

const getCounters = async () => {
  try {
    let counters = await query("SELECT * FROM counters");
    return counters;
  } catch (e) {
    return null;
  }
}

const loadCounters = async () => {
  //Load all watched channels from DB
  try {
    let counters = await query("SELECT * FROM counters");
    let countersObj = {};
    //CountersObj is a hashTable with Server_Id as keys, and a list of Channel_Ids as values
    for (let i = 0; i < counters.length; i++) {
      let counter = counters[i];
      let key = counter.server_id;
      if (key in countersObj) {
        countersObj[key].push(counter.channel_id);
      } else {
        countersObj[key] = [counter.channel];
      }
    }
    console.log("Loaded Counters!");
    return countersObj;
  } catch (e) {
    return false;
  }
};

const addCounter = async (counters, server_id, channel_id, startCount) => {
  try {
    let count = await checkCounter(server_id, channel_id);
    if (count) {
      return "This channel is already being tracked!";
    } else {
      await insertCounter(server_id, channel_id, startCount);
      if (server_id in counters) {
        counters[server_id].push(channel_id);
      } else {
        counters[server_id] = [channel_id];
      }
      return "Success! This channel is now being tracked.";
    }
  } catch (e) {
    return "There was an error tracking this channel :(";
  }
};

const remCounter = async (counters, server_id, channel_id) => {
  try {
    await query(
      `DELETE FROM counters WHERE server_id = ${server_id} AND channel_id = ${channel_id}`
    );
    counters[server_id].splice(counters[server_id].indexOf(channel_id), 1);
    return `This channel is no longer being tracked`;
  } catch (e) {
    console.log(e);
    return `There was an error removing that channel from the tracking list :()`;
  }
};

const checkCounter = async (server_id, channel_id) => {
  let results = await query(
    `SELECT count FROM counters WHERE server_id = ${server_id} AND channel_id = ${channel_id}`
  );
  if (results.length > 0) {
    return results[0].count;
  }
  return;
};

const getCounter = async (server_id, channel_id) => {
  let results = await query(
    `SELECT * FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND count > 0 ORDER BY count DESC LIMIT 1`
  )
  if (results.length > 0) {
    return results[0]
  }
  return;
}

const insertCounter = async (server_id, channel_id, count) => {
  await query("INSERT INTO counters SET ?", {
    server_id,
    channel_id,
    count
  });
};

const updateCounter = async (server_id, channel_id, count) => {
  await query(
    `UPDATE counters SET count = ${count} WHERE server_id = ${server_id} AND channel_id = ${channel_id}`
  );
};

module.exports = {
  getCounters,
  loadCounters,
  addCounter,
  remCounter,
  checkCounter,
  getCounter,
  insertCounter,
  updateCounter
};

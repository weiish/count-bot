class CountStats {
  constructor() {
    this.messages = [];
    this.loaded = false;
    this.type = "unknown";
  }

  async loadChannelMessages(query, server_id, channel_id) {
    if (this.loaded) throw new Error ('Attempted to load messages into CountStats Object that has already been loaded')
    try {
      this.messages = await query(
        `SELECT * FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND count > 0`
      );
      this.type = "channel";
      this.loaded = true;
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  };

  async loadUserMessages(query, server_id, channel_id, user_id) {
    if (this.loaded) throw new Error ('Attempted to load messages into CountStats Object that has already been loaded')
    try {
      this.messages = await query(
        `SELECT * FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND user_id = ${user_id} AND count > 0`
      );
      this.type = "user";
      this.loaded = true;
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  };

  getTotalCounts(user_id) {
    if (!this.loaded) throw new Error('getTotalCounts was called before loading');
    if (user_id) {
        return this.messages.filter(message => {
            return message.user_id === user_id
        }).length
    } else {
        return this.messages.length
    }
  }

  getCountsByMonth() {

  }

  getCountsByDate() {

  }

  getCountsByHour() {

  }

  getCountsByDay() {

  }
}

const getCountMessages = async (server_id, channel_id) => {
  //Pulls all messages from server / channel with counts
};

const getUserMessages = async (server_id, channel_id, user_id) => {
  //Pulls all messages from server / channel from user with counts
};

module.exports = { CountStats }
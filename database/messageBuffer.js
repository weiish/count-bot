const BufferStates = {
  Default: 0,
  FastCount: 1,
  CatchUp: 2,
  ReviewFromDowntime: 3,
}

class MessageBuffer {
  
  //Currently only supports counts with interval of 1 (people alternate every 1 count), if we want more intervals this needs changed
  constructor(server_id, channel_id, count, lastMessage, query, client) {    
    

    this.server_id = server_id;
    this.channel_id = channel_id;
    this.count = count;
    this.recentMessages = [];
    this.messagesToWrite = [];
    this.messagesToReact = [];    
    this.hasWrittenAMessage = false;
    this.lastMessage = lastMessage;
    this.state = 3;
    this.initializeTime = Date.now();
    this.DATABASE_WRITE_INTERVAL = 10000; //in milliseconds    
    this.REACTION_FETCH_TIME_INTERVAL = 20000; //in milliseconds
    this.CATCHUP_REACTION_INTERVAL = 2000; //in milliseconds
    this.INITIALIZATION_DELAY = 10000; // in milliseconds
    this.lastDatabaseWriteTime = Date.now();
    this.lastReactionFetchTime = Date.now() - 20000;
    this.lastCatchUpReactionTime = Date.now();
    this.fastModeReactionCounter = 0;
    this.FAST_MODE_REACT_INTERVAL = 3;
    this.query = query;
    this.client = client;

  }

  ShouldAddReaction() {
    //Logic to determine based on state whether we should add a reaction for the next valid count
    if (this.state !== BufferStates.FastCount) {
      this.fastModeReactionCounter = 1;
      return true;
    }

    //State = fast count mode
    if (this.fastModeReactionCounter >= this.FAST_MODE_REACT_INTERVAL) {
      this.fastModeReactionCounter = 1;
      return true;
    }

    this.fastModeReactionCounter++;
    return false;
  }

  GetLastCountUser() {    
    if (this.lastMessage === undefined) {
      return 0;
    } else {
      return this.lastMessage.user_id;
    }
  }

  GetLastMessageId() {
    if (this.lastMessage === undefined) {
      return 0;
    } else {
      return this.lastMessage.message_id;
    }
  }

  GetCount() {
    return this.count;
  }

  GetLastCountTimestamp() {
    if (this.lastMessage === undefined) {
      return Date.UTC(0);
    } else {
      return this.lastMessage.timestamp;
    }
  }

  async WriteMessagesToDatabase() {
    //Loop through messagesToWrite, generate one large insert script, and execute it
    //This should happen every minute, so every tick should check if the last update time was over a minute ago    
    this.lastDatabaseWriteTime = Date.now();
    this.hasWrittenAMessage = true;

    let sql =
      "INSERT INTO messages (message_id, server_id, channel_id, user_id, message_content, timestamp, count, hasReaction) VALUES ?";
    let messageValues = [];
    let moneyHashTable = {};
    let j = this.messagesToWrite.length;
    console.log(`Writing ${j} messages to db for channel ${this.channel_id}`);
    let lastCount;
    while (j > 0) {
      let message = this.messagesToWrite.shift();
      messageValues.push([
        message.message_id,
        message.server_id,
        message.channel_id,
        message.user_id,
        message.message_content,
        message.timestamp,
        message.count,
        message.hasReaction,
      ]);

      lastCount = message.count + 1;

      if (message.user_id in moneyHashTable) {
        moneyHashTable[message.user_id]++;
      } else {
        moneyHashTable[message.user_id] = 1;
      }
      j--;
    }
    //Insert messages
    await this.query(sql, [messageValues]);

    //Update counter
    await this.query(`UPDATE counters SET count = ${lastCount} WHERE server_id = ${this.server_id} AND channel_id = ${this.channel_id}`)

    //Run money scripts
    //TODO: multiple DB calls here is awful, figure out a better way
    for (const user_id in moneyHashTable) {
      await this.query(
        `INSERT INTO money (user_id, money) VALUES (${user_id}, ${moneyHashTable[user_id]}) ON DUPLICATE KEY UPDATE money = money + ${moneyHashTable[user_id]}`
      );
      console.log(`Giving user ${user_id} $${moneyHashTable[user_id]}`);
    }
  }

  async Tick() {    
    //Move messages out of recentMessages (to get written to DB) if it has been over a 30 seconds for them;
    this.ProcessOldMessages();
    await this.UpdateState();

    if (this.state === BufferStates.CatchUp && this.lastCatchUpReactionTime < Date.now() - this.CATCHUP_REACTION_INTERVAL) {
      //Get earliest count from database that needs a count and add a reaction to it
      await this.ReactToOldestMessage();
    }

    if (
      this.lastDatabaseWriteTime < Date.now() - this.DATABASE_WRITE_INTERVAL &&
      this.messagesToWrite.length > 0
    ) {
      await this.WriteMessagesToDatabase();      
    }

    if (this.lastReactionFetchTime < Date.now() - this.REACTION_FETCH_TIME_INTERVAL) {
        await this.FetchMessagesToReact();
    }
  }

  ProcessOldMessages(cutoffTime) {
    cutoffTime = typeof cutoffTime !== "undefined" ? cutoffTime : new Date(Date.now() - this.DATABASE_WRITE_INTERVAL);    
    let j = this.recentMessages.length;
    let moved = 0;
    for (let i = 0; i < j; i++) {
      let message = this.recentMessages[i];
      if (message.timestamp < cutoffTime) {
        this.messagesToWrite.push(this.recentMessages.shift());
        i--;
        j--;
        moved++;
      } else {
        break;
      }
    }
    //if (moved > 0) console.log("Moved " + moved + " messages to write array");
  }

  async FetchMessagesToReact() {
      
    this.lastReactionFetchTime = Date.now();
    this.messagesToReact = await this.query(`SELECT * FROM messages WHERE server_id = ${this.server_id} AND channel_id = ${this.channel_id} AND hasReaction = 0 ORDER BY timestamp ASC`);   
    if (this.messagesToReact.length > 0) console.log(`Fetched ${this.messagesToReact.length} messages to react to for channel ${this.channel_id}`);
    //console.log(this.messagesToReact);
  }

  async ReactToOldestMessage() {
    if (this.messagesToReact.length === 0) return;
    //console.log("Reacting to oldest message...");
    let message = this.messagesToReact.find(msg => msg.hasReaction === 0);
    if (message !== undefined) {        
        //console.log("Found message to react to " + message.message_content);
        try {
          let channel = await this.client.channels.cache.get(this.channel_id);
          if (channel === undefined) {
            channel = await this.client.channels.fetch(this.channel_id);
          }
            let reactMsg = await channel.messages.fetch(message.message_id);
            await reactMsg.react('✅');
            this.lastCatchUpReactionTime = Date.now();
        } catch (e) {
            console.log(e);
        }
        
        message.hasReaction = 1;
        await this.query(`UPDATE messages SET hasReaction = 1 WHERE message_id = ${message.message_id}`);
    }
  }

  async UpdateState() {
    if (this.state === BufferStates.ReviewFromDowntime) {
      if (this.initializeTime < Date.now() - this.INITIALIZATION_DELAY && this.recentMessages.length === 0) {
        this.state = BufferStates.CatchUp;
        console.log(this.channel_id + " changed to catch up mode");
      }
      return;
    }

    if (this.recentMessages.length > 10 && this.state !== BufferStates.FastCount) {
      this.state = BufferStates.FastCount;
      console.log(this.channel_id + " changed to fast mode");
      //Send message saying we're entering fast mode so only every 5 counts will get a reaction
      let channel = await this.client.channels.cache.get(this.channel_id)
      if (channel === undefined) {
        channel = await this.client.channels.fetch(this.channel_id);
      }
      await channel.send("Detected a lot of counts. Fast Count Mode Activated. Every **3rd count** will get a check mark\nbecause the bot can't react fast enough with rate limitations. (It will fill in the check marks later after y'all calm down)");
    } else if (this.recentMessages.length === 0 && this.state !== BufferStates.CatchUp) {
      this.state = BufferStates.CatchUp;
      console.log(this.channel_id + " changed to catch up mode");
    } else if (
      this.recentMessages.length < 10 &&
      this.recentMessages.length > 0 &&
      this.state !== BufferStates.Default
    ) {
      this.state = BufferStates.Default; //Default mode
      console.log(this.channel_id + " changed to default mode");
    }
  }

  AddCount(message) {
    this.recentMessages.push(message);    
    this.lastMessage = message;
    this.count++;
    //Increment count
  }
}

class Message {
  constructor(discordMessage, count, hasReaction) {
    this.message_id = discordMessage.message_id;
    this.server_id = discordMessage.server_id;
    this.channel_id = discordMessage.channel_id;
    this.user_id = discordMessage.user_id;
    this.message_content = discordMessage.message_content;
    this.timestamp = discordMessage.timestamp;
    this.count = count;
    this.hasReaction = hasReaction;
  }
}

const ConvertDiscordMessage = (message) => {
  return {
    message_id: message.id,
    server_id: message.guild.id,
    channel_id: message.channel.id,
    user_id: message.author.id,
    message_content: message.cleanContent,
    timestamp: message.createdAt,
  };
};

module.exports = {
  MessageBuffer,
  Message,
  ConvertDiscordMessage,
};

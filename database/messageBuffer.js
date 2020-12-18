class MessageBuffer {
  constructor(server_id, channel_id, count, lastMessage) {
    this.server_id = server_id;
    this.channel_id = channel_id;
    this.check_interval = 5;
    this.count = count;
    if (lastMessage !== undefined) {
      this.recentMessages = [lastMessage];
    } else {
      this.recentMessages = [];
    }

    this.messagesToWrite = [];
    this.hasWrittenAMessage = false;
    this.state = 0;
    this.lastUpdateTime = Date.now();
    this.lastReaction = 0;
    this.FAST_MODE_REACT_INTERVAL = 5;

    /*
            States are 
            0 = default
            1 = fast count mode
            2 = catch up mode
        */
  }

  ShouldAddReaction() {
    //Logic to determine based on state whether we should add a reaction for the next valid count
    if (this.state === 0 || this.state === 2) {
      this.lastReaction = 1;
      return true;
    }

    //State = fast count mode
    if (this.lastReaction >= this.FAST_MODE_REACT_INTERVAL) {
      this.lastReaction = 1;
      return true;
    }

    this.lastReaction++;
    return false;
  }

  GetLastCountUser() {
    try {
      if (this.recentMessages.length > 0) {
        return this.recentMessages[this.recentMessages.length - 1].user_id;
      } else if (this.messagesToWrite.length > 0) {
        return this.messagesToWrite[this.messagesToWrite.length - 1].user_id;
      }
    } catch (e) {
      return 0;
    }
  }

  GetCount() {
    return this.count;
  }

  WriteMessagesToDatabase() {
    //Loop through messagesToWrite, generate one large insert script, and execute it
    //This should happen every minute, so every tick should check if the last update time was over a minute ago
    this.lastUpdateTime = Date.now();
    this.hasWrittenAMessage = true;
    console.log(this.messagesToWrite);
  }

  Tick() {
    let message = undefined;
    //Move messages out of recentMessages if it has been over a minute for them;
    this.ProcessOldMessages();
    message = this.UpdateState();

    if (this.state === 2 && this.hasWrittenAMessage) {
      //Get earliest count from database that needs a count and add a reaction to it
    }

    if (
      this.lastUpdateTime < Date.now() - 60000 &&
      this.messagesToWrite.length > 0
    ) {
      this.WriteMessagesToDatabase();
    }

    return message;
  }

  ProcessOldMessages() {
    const cutoffTime = new Date(Date.now() - 60000);
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
    if (moved > 0) console.log("Moved " + moved + " messages to write array");
  }

  UpdateState() {
    if (this.recentMessages.length > 5 && this.state !== 1) {
      this.state = 1;
      console.log("changed to fast mode");
      //Send message saying we're entering fast mode so only every 5 counts will get a reaction
      return "Detected a lot of counts. Fast Count Mode Activated. Every **5th count** will get a reaction";
    } else if (this.recentMessages.length === 0 && this.state !== 2) {
      this.state = 2; //Catch up mode
      console.log("changed to catch up mode");
    } else if (
      this.recentMessages.length < 5 &&
      this.recentMessages.length > 0 &&
      this.state !== 0
    ) {
      this.state = 0; //Default mode
      console.log("changed to default mode");
    }
  }

  AddCount(message) {
    this.recentMessages.push(message);
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

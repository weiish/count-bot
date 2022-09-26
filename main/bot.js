const Discord = require("discord.js");
const { MessageAttachment, EmbedBuilder } = require('discord.js');
const client = new Discord.Client();
const keys = require("../config/keys");
const config = require("../config/config");
const conversions = require("../config/conversions");
const diceodds = require("../config/diceodds");
const { connection, query } = require("../database/db");
const moment = require("moment");
const math = require("mathjs");

//Custom Files
const {
  isCreator,
  addAdmin,
  remAdmin,
  loadAdmins,
  isAdminLocal,
  isAdminDB,
} = require("../admin/admin");
const {
  getCounters,
  loadCounters,
  addCounter,
  remCounter,
  checkCounter,
  getCounter,
  insertCounter,
  updateCounter,
} = require("../counting/counter");
const helper = require("../counting/helper");
const { CountStats, getMonth, getDay, getHour } = require("../stats/stats");
const { getImageBuffer, getChartBuffer } = require("../stats/images");
const {
  incrementUserNonCountMessages,
  getUserNonCountMessages,
  insertUserNonCountMessages,
  resetUserNonCountMessages,
} = require("../counting/noncountmessages");
const { generateHelpMessage } = require("./help");
const { getMoney, addMoney, insertMoney } = require("../gambling/money");
const { logGamble } = require("../gambling/gambles");
const {
  MessageBuffer,
  Message,
  ConvertDiscordMessage,
} = require("../database/messageBuffer");
const { debug } = require("console");

const clocks = ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'];

let counters = {};
let admins = {};
let help_info = {};
let messageBuffers = {};

client.on("ready", async () => {
  admins = await loadAdmins();
  counters = await loadCounters();
  messageBuffers = await InitializeMessageBuffers();
  client.user.setActivity(`${config.PREFIX}help`);
  let owner = await client.users.fetch(keys.CREATOR_ID, true);
  owner.send("Ready to go!");
  console.log(`Logged in as ${client.user.tag}!`);
  await FetchMessagesSinceLastBotUptime();
});

client.on("messageUpdate", async (oldMsg, newMsg) => {
  if (oldMsg.author.bot) return;

  let messageBuffer = messageBuffers[oldMsg.channel.id];
  if (messageBuffer === undefined) {
    const lastCount = await getCounter(oldMsg.guild.id, oldMsg.channel.id);
    if (lastCount) {
      if (lastCount.timestamp < oldMsg.createdAt) {
        await handleCounters(newMsg);
      } else if (lastCount.message_id === oldMsg.id) {
        await newMsg.react("❌");
        await newMsg.channel.send(`Next count is ${lastCount.count + 1}`);
      }
    }
  } else {
    if (messageBuffer.GetLastCountTimestamp() < oldMsg.createdAt) {
      await handleCounters(newMsg);
    } else if (messageBuffer.GetLastMessageId().message_id === oldMsg.id) {
      await newMsg.react("❌");
      await newMsg.channel.send(`Next count is ${lastCount.count + 1}`);
    }
  }
  //Check if old message was sent after the most recent count in the channel
});

client.on("message", async (msg) => {
  if (msg.author.bot) return;
  await handleCounters(msg);
  await handleCommands(msg);
});

const handleCounters = async (msg) => {
  if (msg.content.indexOf(config.PREFIX) === 0) return;

  let server_id = msg.guild.id;
  let channel_id = msg.channel.id;

  //Check if current server/channel has a buffer
  let messageBuffer = messageBuffers[channel_id];
  let count;

  if (messageBuffer === undefined) {
    //No buffer, Check if current server/channel is being counted, and if user has already counted previously
    count = await checkCounter(server_id, channel_id);
    if (!count) return;

    let previousUsers = await getLastUsers(
      server_id,
      channel_id,
      count,
      config.REPEAT_INTERVAL
    );
    if (previousUsers) {
      for (let i = 0; i < previousUsers.length; i++) {
        if (previousUsers[i].user_id === msg.author.id) {
          await incrementUserNonCountMessages(
            server_id,
            channel_id,
            msg.author.id
          );
          const userNonCountMessages = await getUserNonCountMessages(
            server_id,
            channel_id,
            msg.author.id
          );
          if (userNonCountMessages) {
            if (userNonCountMessages % 5 === 0 && userNonCountMessages > 0) {
              msg.reply(
                "This channel is for taking turns counting! You're not counting right!"
              );
            }
          }
          return;
        }
      }
    }
  }
  //Use buffer to check if the user has already counted
  else {
    if (messageBuffer.GetLastCountUser() === msg.author.id) {
      return;
    }
    count = messageBuffer.count;
  }
  
  console.log(`parsing message id ${msg.id} content ${msg.content}`);
  // Check if the current message is the current count
  let msgIsCount = tryParseAndFindNumber(msg.content, count);
  if (msgIsCount) {
    if (messageBuffer === undefined) {
      await insertMessage(msg, count, 1);
      await updateCounter(server_id, channel_id, ++count);
      await msg.react("✅");
      await resetUserNonCountMessages(server_id, channel_id, msg.author.id);
      await addMoney(msg.author.id, 1);
    }
    //Use buffer logic
    else {
      let shouldReact = messageBuffer.ShouldAddReaction();
      let message = new Message(ConvertDiscordMessage(msg), count, shouldReact);
      messageBuffer.AddCount(message);
      if (shouldReact) await msg.react("✅");
    }
  } else {
    if (
      msg.content.toLowerCase() === "y" ||
      msg.content.toLowerCase() === "n"
    ) {
      //TODO when doing the command / bot interactions message refactor, apply that here
    }
    // else {
    //   await incrementUserNonCountMessages(server_id, channel_id, msg.author.id);
    //   const userNonCountMessages = await getUserNonCountMessages(
    //     server_id,
    //     channel_id,
    //     msg.author.id
    //   );
    //   if (userNonCountMessages) {
    //     await msg.react("❌");
    //   }
    //   if (userNonCountMessages % 5 === 0) {
    //     msg.reply(
    //       "This channel is for taking turns counting! You're not counting right!"
    //     );
    //   }
    // }
  }
};

const handleCommands = async (msg) => {
  if (msg.content.indexOf(config.PREFIX) !== 0) return;

  const args = msg.content.slice(config.PREFIX.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  if (isCreator(msg.author.id)) {
    if (command === "logout" || command === "lo") {
      msg.reply("Logging out, Bye!");
      client.destroy();
    }
  }

  //Admin commands
  const isAdminFromLocal = await isAdminLocal(admins, msg.guild.id, msg.author.id);
  const isAdminFromDB = await isAdminDB(msg.guild.id, msg.author.id);
  if (isAdminFromLocal || isAdminFromDB || msg.author.id === msg.guild.ownerID) {
    if (command === "fetch") {
      //Check if count is already enabled
      let count = await checkCounter(msg.guild.id, msg.channel.id);
      if (count) return msg.reply("This channel is already being tracked!");
      msg.reply("Fetching all messages in this channel... I will notify you when it is complete");
      await getInitialLog(msg.channel);
    } else if (command === "init" || command === "initialize") {
      //Check if count is already enabled
      let count = await checkCounter(msg.guild.id, msg.channel.id);
      if (!count) count = 1;
      msg.reply(
        "Initializing counts in this channel... I will ask questions if any counts are unsure."
      );
      await initializeCount(
        msg.guild.id,
        msg.channel.id,
        client,
        count,
        config.REPEAT_INTERVAL
      );
    } else if (command === "track") {
      let count = await checkCounter(msg.guild.id, msg.channel.id);
      if (count) return msg.reply("This channel is already being tracked!");

      await addCounter(counters, msg.guild.id, msg.channel.id, 1);
      AddNewMessageBuffer(messageBuffers, msg.guild.id, msg.channel.id);
      msg.reply(
        "This channel is now being tracked starting at **1**!\n*Note that if you want to start at a higher number you'll need to **!fetch** then **!initialize** instead."
      );
    } else if (command === "untrack") {
      let count = await checkCounter(msg.guild.id, msg.channel.id);
      if (!count) return msg.reply("This channel is not being tracked!");
      //Ask for confirmation
      await msg.channel.send(
        "Are you sure you want to untrack this channel? You will have to start over from 1 or go through the initialization process to track it again! (Y/N)"
      );
      const collected = await msg.channel.awaitMessages(
          async (m) => {
            if (m.author.bot) return false;
            if (!m.author.id === msg.author.id) return false;
            if (
              m.content.toLowerCase() === "y" ||
              m.content.toLowerCase() === "n"
            ) {
              return true;
            }
          },
          {
            max: 1,
            time: 120000,
            errors: ["time"],
          }
        );

      final_answer = collected.array()[0].content;
      if (final_answer === "y") {
        delete messageBuffers[msg.channel.id];
        const remResult = await remCounter(
          counters,
          msg.guild.id,
          msg.channel.id
        );
        msg.channel.send(remResult);
      } else {
        msg.channel.send("Untrack cancelled");
      }
    } else if (command === "cleanmessages") {
      let result = await cleanMessages(msg.guild.id, msg.channel.id);
      msg.reply(result);
    } else if (command === "admin") {
      // if (args[0] === "add" || args[0] === "a") {
      //     //Get any mentions
      //     let mentions = msg.mentions.users.array()
      //     for (let i = 0; i < mentions.length; i++) {
      //         let validUserID = await helper.isValidUserID(msg.guild, mentions[i].id)
      //         if (validUserID) {
      //             let result = await addAdmin(admins, msg.guild.id, mentions[i].id, 1)
      //             msg.reply(result)
      //         } else {
      //             msg.reply("That is not a valid user ID")
      //         }
      //     }
      // } else if (args[0] === "remove" || args[0] === "r" || args[0] === "rem") {
      //     let mentions = msg.mentions.users.array()
      //     for (let i = 0; i < mentions.length; i++) {
      //         let result = await remAdmin(admins, msg.guild.id, mentions[i].id)
      //         msg.reply(result)
      //     }
      // }
    }
  }

  //Normal commands
  if (command === "help") {
    await msg.reply("Sending DM!");
    const helpMsg = await generateHelpMessage();
    await msg.author.send(helpMsg);
  } else if (command === "count") {
    let count;
    let messageBuffer = messageBuffers[msg.channel.id];
    let usernames = "";
    let lastUsers;
    if (messageBuffer === undefined) {
      await msg.reply("This channel is not being tracked!");
      return;
    } else {
      count = messageBuffer.GetCount();
      lastUsers = [{user_id: messageBuffer.GetLastCountUser()}];
    }    

    for (let i = 0; i < lastUsers.length; i++) {      
      const user = await client.users.fetch(lastUsers[i].user_id);
      if (i === 0) {
        usernames += user.tag;
      } else {
        usernames += " or " + user.tag;
      }
    }
    if (!count) {
      msg.reply("There is no counting going on in this channel :(");
    } else {
      msg.reply(
        `I'm looking for someone to say **${count}**! But it can't be ` +
          usernames
      );
    }
  } else if (command === "me") {
    let myStats = new CountStats();
    await myStats.loadUserMessages(
      query,
      msg.guild.id,
      msg.channel.id,
      msg.author.id
    );
    msg.reply(
      `you have counted **${myStats.getTotalCounts(
        msg.author.id
      )}** times in this channel!`
    );
  } else if (command === "latest") {
    let myStats = new CountStats();
    await myStats.loadChannelMessages(query, msg.guild.id, msg.channel.id);
    const times = await myStats.getLatestCountTime();
    let my_embed = await formatEmbed("LATEST COUNTERS", "", 1, times, true);
    await msg.channel.send(my_embed);
  } else if (command === "earliest") {
    let myStats = new CountStats();
    await myStats.loadChannelMessages(query, msg.guild.id, msg.channel.id);
    const times = await myStats.getEarliestCountTime();
    let my_embed = await formatEmbed("EARLIEST COUNTERS", "", 1, times, true);
    await msg.channel.send(my_embed);
  } else if (command === "plot") {
    let myStats = new CountStats();
    let reply_msg = "";
    if (args[0] === "my") {
      await myStats.loadUserMessages(
        query,
        msg.guild.id,
        msg.channel.id,
        msg.author.id
      );
      reply_msg += "Graph for **" + msg.author.tag + "**:\n";
    } else if (args[0] === "all") {
      await myStats.loadChannelMessages(query, msg.guild.id, msg.channel.id);
      reply_msg += "Graph for **this channel**:\n";
    } else {
      msg.channel.send(
        "**!plot** *[my|all]* *[month|day|hour]*: You need to choose to plot 'my' or 'all'!"
      );
      return;
    }

    let configuration;
    if (args[1] === "month") {
      configuration = await myStats.getCountsByMonth("bar");
    } else if (args[1] === "day") {
      configuration = await myStats.getCountsByDay("bar");
    } else if (args[1] === "hour") {
      configuration = await myStats.getCountsByHour("bar");
    } else {
      msg.channel.send(
        "**!plot** *[my|all]* *[month|day|hour]*: You need to choose to plot by 'month', 'day', or 'hour'!"
      );
      return;
    }
    let dataUrl = await getChartBuffer(configuration);
    const attachment = new MessageAttachment(dataUrl, "tempgraph.png");
    // const embed = new EmbedBuilder()
    //   .setTitle(reply_msg)
    //   .setImage('attachment://tempgraph.png');
    await msg.channel.send(reply_msg, {files: [attachment]});
  } else if (command === "rank" || command === "top") {
    let myStats = new CountStats();
    await myStats.loadChannelMessages(query, msg.guild.id, msg.channel.id);
    let reply_msg = "";
    let my_embed;
    //TODO pagination
    if (args[0] === "month") {
      // Look for next argument as mm/yy
      let month, year;
      if (args.length > 1) {
        try {
          const parsed_date = parseDate(args[1], "month");
          month = parsed_date.getMonth();
          year = parsed_date.getFullYear();
        } catch (e) {
          return msg.channel.send(
            "**!rank** *month* *MM/YYYY*: Expects a month provided in the format MM/YYYY. If none is provided, the current month and year are used"
          );
        }
      } else {
        month = new Date().getMonth();
        year = new Date().getFullYear();
      }

      const ranks = await myStats.getRanksByMonth(month, year);
      if (ranks.length === 0) {
        await msg.channel.send("No counts recorded for the specified month!");
        return;
      }
      my_embed = await formatEmbed(
        "COUNT SCORES",
        `Of ${getMonth(month)} ${year}`,
        1,
        ranks
      );
    } else if (args[0] === "date") {
      // Look for next argument as mm/dd/yy
      let date, month, year;
      if (args.length > 1) {
        try {
          const parsed_date = parseDate(args[1], "date");
          date = parsed_date.getDate();
          month = parsed_date.getMonth();
          year = parsed_date.getFullYear();
        } catch (e) {
          console.log(e);
          return msg.channel.send(
            "**!rank** *date* *MM/DD/YYYY*: Expects a date provided in the format MM/DD/YYYY. If none is provided, the current date is used"
          );
        }
      } else {
        date = new Date().getDate();
        month = new Date().getMonth();
        year = new Date().getFullYear();
      }
      const ranks = await myStats.getRanksByDay(date, month, year);
      if (ranks.length === 0) {
        await msg.channel.send("No counts recorded for the specified date!");
        return;
      }
      my_embed = await formatEmbed(
        "COUNT SCORES",
        `Of ${getMonth(month)} ${withOrdinalSuffix(date)}, ${year}`,
        1,
        ranks
      );
    } else {
      //Default, ALL ranks
      const ranks = await myStats.getRanksByAll();
      if (ranks.length === 0) {
        await msg.channel.send("No counts recorded!");
        return;
      }
      my_embed = await formatEmbed("COUNT SCORES", "Of All Time", 1, ranks);
    }
    await msg.channel.send(my_embed);
  } else if (command === "review") {
    let counter = await checkCounter(msg.guild.id, msg.channel.id);
    if (!counter) return msg.channel.send("This channel is not being tracked");
    //Get number argument (try to parse)
    try {
      let count = parseInt(args[0]);
      let db_message = await getMessage(msg.guild.id, msg.channel.id, count);
      if (db_message) {
        let link = `https://discordapp.com/channels/${db_message.server_id}/${db_message.channel_id}/${db_message.message_id}\n`;
        let user = await client.users.fetch(db_message.user_id);
        msg.channel.send(
          `**Count:** ${db_message.count}\n**Sent At:** ${db_message.timestamp}\n**${user.tag}** said "${db_message.message_content}"\n**Link:** ${link}`
        );
        //Add link to this message
      } else {
        msg.channel.send("That count was not found in this channel");
      }
    } catch (e) {
      msg.channel.send(
        "**!review** *count* : the count you provided was invalid"
      );
    }
  } else if (command === "money" || command === "m") {
    let money = await getMoney(msg.author.id);
    if (money == null) money = 0;
    msg.reply(`you have $**${money}** (If you counted recently, give it 1 minute to update)`);
  } else if (command === "flip") {
    if (args.length < 2) {
      return msg.channel.send(
        "**!flip** *[heads/tails]* *[bet]*: Expects heads or tails as the first argument and a positive integer value for the bet"
      );
    }

    let guess = args[0].toLowerCase();
    let win = false;
    //Verify user inputted heads or tails
    if (guess !== "heads" && guess !== "tails") {
      return msg.channel.send(
        "**!flip** *[heads|tails]* *[bet]*: Expects heads or tails as the first argument"
      );
    }

    //Parse amount to bet
    let amount;
    try {
      amount = parseInt(args[1], 10);
      if (isNaN(amount) || amount <= 0) throw new Error("Invalid bet");
      const player_money = await getMoney(msg.author.id);
      if (player_money == null) player_money = 0;
      if (amount > player_money)
        return msg.reply("You don't have enough money :(");
    } catch (e) {
      return msg.channel.send(
        "**!flip** *[heads|tails]* *[bet]*: Expects a positive integer value for the bet"
      );
    }

    //Simulate coinflip
    let result_text = "";
    let result = Math.random();
    if (result >= 0.5) {
      result_text += "**HEADS!**";
      if (guess === "heads") win = true;
    } else {
      result_text += "**TAILS!**";
      if (guess === "tails") win = true;
    }

    if (win) {
      result_text += ` you win $**${amount}**!`;
      await addMoney(msg.author.id, amount);
    } else {
      result_text += ` you lost $**${amount}**!`;
      await addMoney(msg.author.id, -amount);
    }
    msg.reply(result_text);
    await logGamble(
      msg.author.id,
      amount,
      "flip",
      win ? 1 : 0,
      guess === "heads" ? 1 : 0
    );
  } else if (command === "dice") {
    if (args.length < 2) {
      return msg.channel.send(
        "**!dice** *[2-12]* *[bet]*: Expects an integer between 2 and 12 as the first argument and a positive integer value for the bet"
      );
    }

    let guess;
    //Verify user inputted an integer between 2 and 12
    try {
      guess = parseInt(args[0], 10);
      if (isNaN(guess) || guess < 2 || guess > 12)
        throw new Error("Invalid guess");
    } catch (e) {
      return msg.channel.send(
        "**!dice** *[2-12]* *[bet]*: Expects an integer between 2 and 12 inclusive as the first argument"
      );
    }

    //Parse amount to bet
    let amount;
    try {
      amount = parseInt(args[1], 10);
      if (amount <= 0) throw new Error("Invalid bet");
      const player_money = await getMoney(msg.author.id);
      if (player_money == null) player_money = 0;
      if (amount > player_money)
        return msg.reply("You don't have enough money :(");
    } catch (e) {
      return msg.channel.send(
        "**!dice** *[2-12]* *[bet]*: Expects a positive integer value for the bet"
      );
    }

    //Simulate dice roll
    let result_text = "";
    let roll1 = rollDice(6);
    let roll2 = rollDice(6);
    let payout_multiplier = 36 / diceodds[guess];
    let win = roll1 + roll2 === guess;

    result_text += `Rolled **${roll1}** and **${roll2}** for a total of **${
      roll1 + roll2
    }**!`;

    if (win) {
      result_text += ` you win $**${Math.ceil(
        amount * payout_multiplier - amount
      )}**!`;
      await addMoney(
        msg.author.id,
        Math.ceil(amount * payout_multiplier - amount)
      );
    } else {
      result_text += ` you lost $**${amount}**!`;
      await addMoney(msg.author.id, -amount);
    }

    result_text += ` Your odds were ${diceodds[guess]} / 36`;
    msg.reply(result_text);
    await logGamble(msg.author.id, amount, "dice", win ? 1 : 0, guess);
  }
};

const rollDice = (max) => {
  return 1 + Math.floor(Math.random() * max);
};

const withOrdinalSuffix = (i) => {
  var j = i % 10,
    k = i % 100;
  if (j == 1 && k != 11) {
    return i + "st";
  }
  if (j == 2 && k != 12) {
    return i + "nd";
  }
  if (j == 3 && k != 13) {
    return i + "rd";
  }
  return i + "th";
};

const formatMessage = async (title, page, messageArray) => {
  let msg = "";
  msg += `**${title}**\n`;
  for (let i = 0; i < messageArray.length; i++) {
    let user = await client.users.fetch(messageArray[i][0]);
    let usertag = user.tag;
    msg += `${i + 1}. **${usertag} - ** ${messageArray[i][1]}\n`;
  }
  return msg;
};

const formatEmbed = async (
  title,
  description,
  page,
  messageArray,
  isDates = false
) => {
  let fields = [];
  let msg = "";
  let msgTemp = "";
  for (let i = 0; i < messageArray.length; i++) {
    let user = await client.users.fetch(messageArray[i][0]);
    let usertag = user.tag;
    if (isDates) {
      msgTemp += `**#${i + 1}** ${usertag} - **${moment(
        messageArray[i][1]
      ).fromNow()}**\n`;
    } else {
      msgTemp += `**#${i + 1}** ${usertag} - **${messageArray[i][1]}**\n`;
    }
    if (msgTemp.length < 1000) {
      msg = msgTemp;
    } else {
      break;
    }
  }
  fields.push({ name: `*${description}*`, value: msg });

  return {
    embed: {
      title: `***${title}***`,
      color: 1535999,
      //"footer": {text: `Page ${page}`},
      fields: fields,
    },
  };
};

const initializeCount = async (
  server_id,
  channel_id,
  client,
  count = 1,
  repeatInterval
) => {
  let messages = await getMessages(server_id, channel_id);

  if (messages.length > 0) {
    let messages_since_last_found = 0;

    //Checking each message in the DB
    for (let i = 0; i < messages.length; i++) {
      const current_db_message = messages[i];
      if (tryParseAndFindNumber(current_db_message.message_content, count)) {
        //Check if user is the last user who marked a count
        let previousUsers = await getLastUsers(
          server_id,
          channel_id,
          count,
          repeatInterval
        );
        let shouldMark = true;
        if (previousUsers) {
          for (let a = 0; a < previousUsers.length; a++) {
            let user = previousUsers[a];
            if (user.user_id === current_db_message.user_id) {
              //Ask admin if its ok or skip
              let userObj = await client.users.fetch(
                current_db_message.user_id
              );
              let message_entry = `**${userObj.tag}:** ${current_db_message.message_content}\n`;
              let link = `https://discordapp.com/channels/${current_db_message.server_id}/${current_db_message.channel_id}/${current_db_message.message_id}\n`;
              await client.channels.cache
                .get(channel_id)
                .send(
                  `Found match for count **${count}** but the user repeat interval is wrong\n` +
                    message_entry +
                    link +
                    "Should I allow this? (Y/N) admin only"
                );
              const collected = await client.channels.cache
                .get(channel_id)
                .awaitMessages(
                  async (m) => {
                    const isAdmin = await isAdminLocal(
                      admins,
                      m.guild.id,
                      m.author.id
                    );
                    if (!isAdmin) return false;
                    if (
                      m.content.toLowerCase() === "y" ||
                      m.content.toLowerCase() === "n"
                    ) {
                      return true;
                    }
                  },
                  {
                    max: 1,
                    time: 120000,
                    errors: ["time"],
                  }
                );

              final_answer = collected.array()[0].content;
              if (final_answer === "y") {
                shouldMark = true;
              } else {
                shouldMark = false;
              }
            }
          }
        }

        if (shouldMark) {
          await markMessageCount(
            server_id,
            channel_id,
            current_db_message.message_id,
            count
          );
          count++;
        }
      }
    }
  } else {
    await client.channels
      .get(channel_id)
      .send(
        "No message log found for this channel, use **!fetch** first! (admin only)"
      );
  }
  await client.channels.cache
    .get(channel_id)
    .send("Done initializing counters! Found counters up to " + count);
  //"If I'm missing a number, add it with **!addcount** *count_value* *message_id*\n" +
  //"Then use the command **!updatecount**"
  await addCounter(counters, server_id, channel_id, count);
  await AddNewMessageBuffer(messageBuffers, server_id, channel_id, count);
};

const parseDate = (dateString, monthOrDate) => {
  //Expects MM/YYYY or MM/DD/YYYY
  let date = new Date();
  try {
    if (monthOrDate === "date") {
      if (dateString.length !== 10)
        throw new Error("Length of date string is wrong (date)");
      date.setMonth(parseInt(dateString.slice(0, 2)) - 1);
      date.setDate(parseInt(dateString.slice(3, 5)));
      date.setFullYear(parseInt(dateString.slice(6, 10)));
      if (isNaN(date.getTime())) throw new Error();
      return date;
    } else if (monthOrDate === "month") {
      if (dateString.length !== 7)
        throw new Error("Length of date string is wrong (month)");
      date.setMonth(parseInt(dateString.slice(0, 2)) - 1);
      date.setFullYear(parseInt(dateString.slice(3, 7)));
      if (isNaN(date.getTime())) throw new Error();
      return date;
    }
  } catch (e) {
    throw e;
  }
  return;
};

const getMessages = async (server_id, channel_id) => {
  let messages = await query(
    `SELECT * FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} ORDER BY id DESC`
  );
  if (messages) {
    return messages;
  }
  return;
};

const getMessage = async (server_id, channel_id, count) => {
  let message = await query(
    `SELECT * FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND count = ${count}`
  );
  if (message) {
    return message[0];
  }
  return;
};

const markMessageCount = async (server_id, channel_id, message_id, count) => {
  await query(
    `UPDATE messages SET count = ${count} WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND message_id = ${message_id}`
  );

  await checkCounter(server_id, channel_id, async (result) => {
    if (result) {
      //NEED UPDATE
      await updateCounter(server_id, channel_id, count);
    } else {
      //NEED INSERT
      await insertCounter(server_id, channel_id, count);
    }
  });
  return;
};

const getLastUsers = async (server_id, channel_id, count, repeatInterval) => {
  let results = await query(
    `SELECT user_id FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND count > 0 AND count < ${count} AND count > ${
      count - repeatInterval - 1
    } ORDER BY count DESC LIMIT ${repeatInterval}`
  );
  return results;
};

const tryParseAndFindNumber = (content, target) => {
  let no_space_content = content.replace(/\s/g, "");
  no_space_content = no_space_content.toLowerCase();

  //Try converting emojis and keywords to numbers
  const conversion_keys = Object.keys(conversions);
  for (let i = 0; i < conversion_keys.length; i++) {
    if (no_space_content.includes(conversion_keys[i])) {
      let conversion_regex = new RegExp(conversion_keys[i], "g");
      no_space_content = no_space_content.replace(
        conversion_regex,
        conversions[conversion_keys[i]]
      );
    }
  }

  //Try finding 'target' in content
  let targetRegex = new RegExp("s" + target + "s");
  if (targetRegex.test(no_space_content)) {
    return true;
  }

  try {
    let equation = no_space_content.replace(/x/g, "*");
    if (math.evaluate(equation) === target) {
      return true;
    }
  } catch (e) {}

  //Try evaluating equations in the content to find the target
  let mathRegex = /(\d+[\+\/\*\-x\^])*(\d+)/g;
  let matches = no_space_content.match(mathRegex);
  if (matches) {
    for (let i = 0; i < matches.length; i++) {
      let match = matches[i].replace(/x/g, "*");
      if (math.evaluate(match) === target) {
        return true;
      }
    }
  }

  return false;
};

const insertMessage = async (message, count, hasReaction) => {
  try {
    await query("INSERT INTO messages SET ?", {
      message_id: message.id,
      server_id: message.guild.id,
      channel_id: message.channel.id,
      user_id: message.author.id,
      message_content: message.cleanContent,
      timestamp: message.createdAt,
      count: count,
      hasReaction: hasReaction,
    });
    return "Message inserted!";
  } catch (e) {
    return "Error inserting message: " + e.message;
  }
};

const cleanMessages = async (server_id, channel_id) => {
  try {
    await query(
      `DELETE FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND count = -1`
    );
    return "Cleaned DB messages for this server!";
  } catch (e) {
    return "Issue cleaning DB messages for this server " + e.message;
  }
};

const getInitialLog = async (channel) => {
  //Delay between loops
  let before;
  let limit = 100;
  console.log("Initializing fetch in channel id " + channel.id);

  const fetchSomeMessages = async (
    channel,
    limit,
    before,
    total = 0,
    ignored = 0,
    status_msg = 0
  ) => {
    let newBefore;

    let fetched_messages = await channel.messages.fetch({ limit, before });
    let messages_array = fetched_messages.array();
    //LAST MESSAGE IN ARRAY SHOULD BE EARLIEST MESSAGE
    //get ID of earliest msg
    newBefore = fetched_messages.lastKey();

    for (let i = 0; i < messages_array.length; i++) {
      let message = messages_array[i];
      if (message.author.bot) {
        ignored++;
        continue;
      }
      //See if entry already exists before inserting
      const query_messsage = await query(
        `SELECT * FROM messages WHERE message_id = ${message.id}`
      );
      if (query_messsage.length === 0) {
        total++;
        await insertMessage(message, -1, 1);
      } else {
        ignored++;
      }
      await sleep(100);
    }

    //RECURSE IF MORE MESSAGES
    let numMessagesFetched = messages_array.length;
    if (numMessagesFetched === limit) {
      if (status_msg === 0) {
        status_msg = await channel.send("Fetching...");
      } else {
        await status_msg.edit(`Fetched ${total} and ignored ${ignored}`);
      }

      await sleep(2000);
      return await fetchSomeMessages(
        channel,
        limit,
        newBefore,
        total,
        ignored,
        status_msg
      );
    } else {
      channel.send(
        `Done Fetching ${total} Messages! Ignored ${ignored} from bots`
      );
    }
  };

  try {
    await fetchSomeMessages(channel, limit, before);
  } catch (e) {
    console.log(e);
  }
};

const FetchMessagesSinceLastBotUptime = async () => {
  let counters = await getCounters();
  let limit = 10;
  let clockCounter = 0;
  for (let i = 0; i < counters.length; i++) {
    let tempMessage;
    let counter = counters[i];
    let lastMessage = await getMessage(
      counter.server_id,
      counter.channel_id,
      counter.count - 1
    );
    let channel = client.channels.cache.get(counter.channel_id);  

    const ProcessSomeMessages = async (
      channel,
      limit = 100,
      after,
      total = 0,
      ignored = 0,
      status_msg = 0
    ) => {
      let newAfter;
  
      let fetched_messages = await channel.messages.fetch({ limit:10, after});
      let messages_array = fetched_messages.array();
      console.log(`Fetched ${messages_array.length} messages`);

      if (messages_array.length > 0) {
        if (tempMessage === undefined) {
          tempMessage = await channel.send(`Found some messages since I was last running, catching up... please wait... ${clocks[clockCounter]}`);          
          clockCounter++;
          if (clockCounter >= clocks.length) clockCounter = 0;
        }        
        else {
          await tempMessage.edit(`Found some messages since I was last running, catching up... please wait... ${clocks[clockCounter]}`);
        }
      }
      //LAST MESSAGE IN ARRAY SHOULD BE LAST MESSAGE
      //get ID of last msg
      newAfter = messages_array[0]?.id;

      for (let i = messages_array.length - 1; i >= 0; i--) {
        let message = messages_array[i];
        if (message.author.bot) {
          ignored++;
          continue;
        } else {
          total++;
          await handleCounters(message);
        }
      }
  
      //RECURSE IF MORE MESSAGES
      let numMessagesFetched = messages_array.length;
      if (numMessagesFetched >= limit) {
        await sleep(2000);
        return await ProcessSomeMessages(
          channel,
          limit,          
          newAfter,
          total,
          ignored,
          status_msg
        );
      } else {
        if (tempMessage !== undefined) {
          tempMessage.delete();
          tempMessage = await channel.send(
            `Done catching up ${total} message(s) 😊`
          );
          setTimeout(() => tempMessage.delete(), 5000)
        }                
      }
    };
  
    try {
      await ProcessSomeMessages(channel, limit, lastMessage.message_id);
    } catch (e) {
      console.log(e);
    }
    
  }
}

const InitializeMessageBuffers = async () => {
  let counters = await getCounters();
  let messageBuffers = {}; //Use channel_id as keys, channel_id's are also unique

  for (let i = 0; i < counters.length; i++) {
    let counter = counters[i];
    let lastMessage = await getMessage(
      counter.server_id,
      counter.channel_id,
      counter.count - 1
    );
    let messageBuffer = new MessageBuffer(
      counter.server_id,
      counter.channel_id,
      counter.count,
      lastMessage,
      query,
      client
    );
    messageBuffers[counter.channel_id] = messageBuffer;
  }
  console.log("Initialized Message Buffers");
  return messageBuffers;
};

const AddNewMessageBuffer = async (existingBuffers, server_id, channel_id, count = 1) => {
  let newBuffer = new MessageBuffer(
    server_id,
    channel_id,
    count,
    undefined,
    query,
    client
  );
  existingBuffers[channel_id] = newBuffer;
}

const sleep = require("util").promisify(setTimeout);

async function BufferTimer() {
  for (const channel_id in messageBuffers) {
    await messageBuffers[channel_id].Tick();
  }
}

setInterval(BufferTimer, 2000);

let token = process.env.BOT_TOKEN || keys.TOKEN;
client.login(token);

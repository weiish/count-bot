const Discord = require("discord.js");
const client = new Discord.Client();
const keys = require("./config/keys");
const config = require("./config/config");
const conversions = require("./config/conversions");
const { connection, query } = require("./database/db");
const moment = require("moment");
const math = require("mathjs");

//Custom Files
const { isCreator, addAdmin, remAdmin, 
    loadAdmins, isAdminLocal, isAdminDB } = require('./admin')
const { loadCounters, addCounter, remCounter, 
    checkCounter, insertCounter, updateCounter } = require('./counter')
const helper = require('./helper')
const {CountStats} = require('./stats')

let counters = {};
let admins = {};

client.on("ready", async () => {
  admins = await loadAdmins();
  counters = await loadCounters();
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", msg => {
  if (msg.author.bot) return;
  handleCounters(msg);
  handleCommands(msg);
});

const handleCounters = async msg => {
    if (msg.content.indexOf(config.PREFIX) === 0) return;
    
    let server_id = msg.guild.id;
    let channel_id = msg.channel.id;

    //Check if current server/channel is being counted
    let count = await checkCounter(server_id, channel_id);
    if (!count) return;

    //Check if user has already contributed to counter within limit
    let previousUsers = await getLastUsers(server_id, channel_id, config.REPEAT_INTERVAL)
    if (previousUsers) {
        for (let i = 0; i < previousUsers.length; i++) {
            if (previousUsers[i].user_id === msg.author.id) {
                //TODO
                //Add to user's non-count messages
                return;
            }
        }
    }
    
    let msgIsCount = tryParseAndFindNumber(msg.content, count)
    if (msgIsCount) {
        await updateCounter(server_id, channel_id, ++count)
        await insertMessage(msg, count);
        await msg.react('✅')
    } else {
        console.log('Message does not match the expected ' + count)
    }
}

const handleCommands = async msg => {
  if (msg.content.indexOf(config.PREFIX) !== 0) return;

  const args = msg.content
    .slice(config.PREFIX.length)
    .trim()
    .split(/ +/g);
  const command = args.shift().toLowerCase();

  if (isCreator(msg.author.id)) {
    if (command === "logout" || command === "lo") {
        msg.reply("Logging out, Bye!");
        client.destroy();
    }
  }

  //Admin commands
  const isAdmin = await isAdminLocal(admins, msg.guild.id, msg.author.id);
  if (isAdmin) {
     if (command === "fetch") {
      msg.reply("Fetching all messages in this channel...");
      getInitialLog(msg.channel);
    } else if (command === "initialize") {
      msg.reply("Initializing counter in this channel...");
      initializeCount(
        msg.guild.id,
        msg.channel.id,
        client,
        config.REPEAT_INTERVAL
      );
    } else if (command === "track") {
        let count = await checkCounter(msg.guild.id, msg.channel.id);
        if (count) return msg.reply('This channel is already being tracked!');
        
        await addCounter(counters, msg.guild.id, msg.channel.id, 1);
        msg.reply('This channel is now being tracked starting at **1**!\n*Note that if you want to start at a higher number you\'ll need to **!fetch** then **!initialize** instead.')
    } else if (command === "untrack") {
        let count = await checkCounter(msg.guild.id, msg.channel.id);
        if(!count) return msg.reply('This channel is not being tracked!')
        //Ask for confirmation
        msg.channel.send('Are you sure you want to untrack this channel? You will have to start over from 1 or go through the initialization process to track it again! (Y/N)')
        const collected = await client.channels
                .get(msg.channel.id)
                .awaitMessages(
                  async m => {
                    if (m.author.bot) return false;
                    if (!m.author.id === msg.author.id) return false
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
                    errors: ["time"]
                  }
                );

              final_answer = collected.array()[0].content;
              if (final_answer === "y") {
                const remResult = await remCounter(counters, msg.guild.id, msg.channel.id)
                msg.channel.send(remResult)
              } else {
                msg.channel.send('Untrack cancelled')
              }
    } else if ( command === "cleanmessages") {
       let result = await cleanMessages(msg.guild.id, msg.channel.id);
        msg.reply(result);
    } else if (command === "admin") {
        if (args[0] === "add" || args[0] === "a") {
            //Get any mentions
            let mentions = msg.mentions.users.array()
            for (let i = 0; i < mentions.length; i++) {
                let validUserID = await helper.isValidUserID(msg.guild, mentions[i].id)
                if (validUserID) {
                    let result = await addAdmin(admins, msg.guild.id, mentions[i].id, 1)
                    msg.reply(result)
                } else {
                    msg.reply("That is not a valid user ID")
                }
            }
        } else if (args[0] === "remove" || args[0] === "r" || args[0] === "rem") {
            let mentions = msg.mentions.users.array()
            for (let i = 0; i < mentions.length; i++) {
                let result = await remAdmin(admins, msg.guild.id, mentions[i].id)
                msg.reply(result)
            }
        }
    }
  }

  //Normal commands
  if (command === "ping") {
    msg.reply("Pong!");
  } else if (command === "create") {
    createUser(msg.author.id, sendMsg => {
      msg.reply(sendMsg);
    });
  } else if (command === "count") {
    const count = await checkCounter(msg.guild.id, msg.channel.id);
    const lastUsers = await getLastUsers(msg.guild.id, msg.channel.id, config.REPEAT_INTERVAL)
    let usernames = ''
    for (let i = 0; i < lastUsers.length; i++) {
        const user = await client.fetchUser(lastUsers[i].user_id);
        if (i === 0) {
            usernames += user.tag
        } else {
            usernames += ' or ' + user.tag
        }
        
    }
    if (!count) {
        msg.reply('There is no counting going on in this channel :(')
    } else {
        msg.reply(`I'm looking for someone to say **${count}**! But it can't be ` + usernames)
    }
  } else if (command === "me") {
    let myStats = new CountStats();
    await myStats.loadUserMessages(query, msg.guild.id, msg.channel.id, msg.author.id)
    msg.reply(`you have counted **${myStats.getTotalCounts(msg.author.id)}** times in this channel!`)
  } else if (command === "stats") {
    let myStats = new CountStats();
    await myStats.loadChannelMessages(query, msg.guild.id, msg.channel.id)
    msg.channel.send(`People have counted **${myStats.getTotalCounts()}** times in this channel!`)
  } else if (command === "review") {
    let counter = await checkCounter(msg.guild.id, msg.channel.id);
    if (!counter) return msg.channel.send('This channel is not being tracked')
    //Get number argument (try to parse)
    try {
        let count = parseInt(args[0])
        let db_message = await getMessage(msg.guild.id, msg.channel.id, count);
        if (db_message) {
            let link = `https://discordapp.com/channels/${
                db_message.server_id
              }/${db_message.channel_id}/${
                db_message.message_id
              }\n`;
            let user = await client.fetchUser(db_message.user_id);
            msg.channel.send(`**Count:** ${db_message.count}\n**Sent At:** ${db_message.timestamp}\n**${user.tag}** said "${db_message.message_content}"\n**Link:** ${link}`)
            //Add link to this message
        } else {
            msg.channel.send('That count was not found in this channel')
        }
    } catch(e) {
        msg.channel.send('**!review** *count* : the count you provided was invalid')
    }
  }
};

const initializeCount = async (
  server_id,
  channel_id,
  client,
  repeatInterval
) => {
  let messages = await getMessages(server_id, channel_id);

  let count = 1;
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
          repeatInterval
        );
        let shouldMark = true;
        if (previousUsers) {
          for (let a = 0; a < previousUsers.length; a++) {
            let user = previousUsers[a];
            if (user.user_id === current_db_message.user_id) {
              //Ask admin if its ok or skip
              let userObj = await client.fetchUser(current_db_message.user_id);
              let message_entry = `**${userObj.tag}:** ${
                current_db_message.message_content
              }\n`;
              let link = `https://discordapp.com/channels/${
                current_db_message.server_id
              }/${current_db_message.channel_id}/${
                current_db_message.message_id
              }\n`;
              await client.channels
                .get(channel_id)
                .send(
                  `Found match for count **${count}** but the user repeat interval is wrong\n` +
                    message_entry +
                    link +
                    "Should I allow this? (Y/N) admin only"
                );
              const collected = await client.channels
                .get(channel_id)
                .awaitMessages(
                  async m => {
                    const isAdmin = await isAdminLocal(admins, m.guild.id, m.author.id);
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
                    errors: ["time"]
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

      //   if (messages_since_last_found > 9) {
      //     let question_prompt =
      //       "```\nI'm having trouble finding **" +
      //       count +
      //       "**, are any of the following messages it?\n";
      //     let final_answer = -1;

      //     //Generate Question Prompt with all the messages
      //     for (let j = i - messages_since_last_found; j < i; j++) {
      //       let db_message = messages[j];
      //       if (j === i - messages_since_last_found) {
      //         question_prompt += `Link to messages: https://discordapp.com/channels/${
      //           db_message.server_id
      //         }/${db_message.channel_id}/${db_message.message_id}\n`;
      //       }
      //       let user = await client.fetchUser(db_message.user_id);
      //       let message_entry = `**${j}**: **${user.tag}:** ${
      //         db_message.message_content
      //       }\n`;
      //       question_prompt += message_entry;
      //     }

      //     //Collect response with one of the question indexes
      //     client.channels.get(channel_id).send(question_prompt);
      //     const collected = await client.channels
      //       .get(channel_id)
      //       .awaitMessages(
      //         m => {
      //           if (!keys.ADMIN_IDS.includes(m.author.id)) {
      //             return false;
      //           }
      //           const answer = parseInt(m.content);
      //           if (answer >= i - messages_since_last_found && answer < i) {
      //             return true;
      //           }
      //         },
      //         {
      //           max: 1,
      //           time: 120000,
      //           errors: ["time"]
      //         }
      //       );

      //     final_answer = parseInt(collected.array()[0].content);
      //     if (final_answer > 0) {
      //       //Mark selected question as "count" and move on
      //       markMessageCount(
      //         server_id,
      //         channel_id,
      //         messages[final_answer].message_id,
      //         count
      //       );
      //       count++;
      //     }
      //   }
    }
  } else {
    await client.channels
      .get(channel_id)
      .send(
        "No message log found for this channel, use **!fetch** first! (admin only)"
      );
  }
  await client.channels.get(channel_id).send("Done initializing counters! Found counters up to " + count + '\n' + 
  "If I'm missing a number, add it with **!addcount** *count_value* *message_id*\n" + 
  "Then use the command **!updatecount**" );
  await addCounter(counters, server_id, channel_id, count)

};

const getMessages = async (server_id, channel_id) => {
  let messages = await query(
    `SELECT * FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} ORDER BY timestamp`
  );
  if (messages) {
    return messages;
  }
  return;
};

const getMessage = async (server_id, channel_id, count) => {
    let message = await query(`SELECT * FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND count = ${count}`)
    if (message) {
        return message[0];
    }
    return;
}

const markMessageCount = async (server_id, channel_id, message_id, count) => {
  console.log(
    `marking message ${server_id} / ${channel_id} / ${message_id} as count ${count}`
  );
  await query(
    `UPDATE messages SET count = ${count} WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND message_id = ${message_id}`
  );

  await checkCounter(server_id, channel_id, async result => {
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

const getLastUsers = async (server_id, channel_id, repeatInterval) => {
  let results = await query(`SELECT user_id FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} ORDER BY count DESC LIMIT ${repeatInterval}`)
  return results;
}

const tryParseAndFindNumber = (content, target) => {
  //console.log("Initial content: ", content);
  let no_space_content = content.replace(/\s/g, "");

  //console.log("No space content: ", no_space_content);
  //Try converting emojis and keywords to numbers
  const conversion_keys = Object.keys(conversions);
  for (let i = 0; i < conversion_keys.length; i++) {
    if (no_space_content.includes(conversion_keys[i])) {
      no_space_content = no_space_content.replace(
        conversion_keys[i],
        conversions[conversion_keys[i]]
      );
    }
  }
  //console.log("Converted content: ", no_space_content);

  //Try finding 'target' in content
  let targetRegex = new RegExp("s" + target + "s");
  if (targetRegex.test(no_space_content)) {
    return true;
  }

  //Try evaluating equations in the content to find the target
  let mathRegex = /(\d+[\+\/\*\-x])*(\d+)/g;
  let matches = no_space_content.match(mathRegex);
  if (matches) {
    for (let i = 0; i < matches.length; i++) {
      let match = matches[i].replace("x", "*");
      if (math.evaluate(match) === target) {
        //console.log(match, "evaluates to", target);
        return true;
      }
    }
  }

  return false;
};

const insertMessage = async (message, count) => {
    try {
        await query("INSERT INTO messages SET ?", {
            message_id: message.id,
            server_id: message.guild.id,
            channel_id: message.channel.id,
            user_id: message.author.id,
            message_content: message.cleanContent,
            timestamp: message.createdAt,
            count: count
          });
        return 'Message inserted!'
    } catch (e) {
        return 'Error inserting message :('
    }
}

const cleanMessages = async (server_id, channel_id) => {
    try {
        await query(`DELETE FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND count = -1`)
        return "Cleaned DB messages for this server!"
    } catch (e) {
        return "Issue cleaning DB messages for this server... :("
    }
}

const getInitialLog = async channel => {
  //Delay between loops
  let before;
  let limit = 100;
  console.log("Initializing fetch in channel id " + channel.id);

  const fetchSomeMessages = async (channel, limit, before, total=0) => {
    let newBefore;
    channel
      .fetchMessages({ limit, before })
      .then(messages => {
        //LAST MESSAGE IN ARRAY SHOULD BE EARLIEST MESSAGE
        //get ID of earliest msg
        newBefore = messages.lastKey();

        messages.array().forEach(async message => {
          if (message.author.bot) {
            return;
          }
          //See if entry already exists before inserting
          await query(
            `SELECT * FROM messages WHERE message_id = ${message.id}`,
            async (err, rows) => {
              if (err) throw err;
              if (rows.length === 0) {
                  await insertMessage(message, -1);
              }
            }
          );
        });

        //RECURSE IF MORE MESSAGES
        let numMessagesFetched = messages.array().length
        if (numMessagesFetched === limit) {
          console.log("Fetching more...");
          if (total % 200 === 0) {
            channel.send("Fetching more...")
          }
          setTimeout(async () => {
            await fetchSomeMessages(channel, limit, newBefore, total+numMessagesFetched);
          }, 2000);
        } else {
          console.log("DONE!");
          channel.send(`Done Fetching ${total + numMessagesFetched} Messages!`);
        }
      })
      .catch(console.error);
  };

  await fetchSomeMessages(channel, limit, before);
};


//Add reaction to msg that gets registered to the counter
//Msg must be sent by user that is not the same as the last user
//Bot internally tracks the count
//Bot saves msg after the count

// const createUser = (id, sendMsg) => {
//   //Check if user already exists
//   findUser(id, user => {
//     if (!user) {
//       //User does not exist, create user
//       //Check if message already exists
//       query("INSERT INTO users SET ?", { id }, (err, res) => {
//         if (err) throw err;
//         connection.commit(function(err) {
//           if (err) {
//             connection.rollback(function() {
//               throw err;
//             });
//           }
//           console.log("ID inserted: " + id);
//           sendMsg("Account created!");
//         });
//       });
//     } else {
//       sendMsg("Account already exists");
//     }
//   });
// };

// const findUser = async (id, callback) => {
//   //Query MySQL for username
//   let foundUser;
//   await query(`SELECT * FROM users WHERE id = ${id}`, (err, rows) => {
//     if (err) throw err;
//     if (rows.length > 0) {
//       callback(rows[0]);
//     } else {
//       callback(0);
//     }
//   });
// };

client.login(process.env.BOT_TOKEN || keys.TOKEN);

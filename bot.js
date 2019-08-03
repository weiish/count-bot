const Discord = require("discord.js");
const client = new Discord.Client();
const keys = require("./config/keys");
const config = require("./config/config");
const conversions = require("./config/conversions");
const { connection, query } = require("./database/db");
const moment = require("moment");
const math = require("mathjs");

let watchChannels = [];
let admins = {}; //Save arrays of user ids under server_ids as the keys

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", msg => {
  handleCommands(msg);
});

const handleCommands = async msg => {
  if (msg.author.bot) return;

  if (msg.content.indexOf(config.PREFIX) !== 0) return;
  const args = msg.content
    .slice(config.PREFIX.length)
    .trim()
    .split(/ +/g);
  const command = args.shift().toLowerCase();

  //Admin commands
  //Maybe swap logic for optimization and only check admins in DB if an ADMIN command is invoked
  if (keys.ADMIN_IDS.includes(msg.author.id)) {
    if (command === "logout" || command === "lo") {
      msg.reply("Logging out, Bye!");
      client.destroy();
    } else if (command === "fetch") {
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
    } else if (command === "compare") {
      await query(
        `SELECT * FROM messages WHERE server_id = ${
          msg.guild.id
        } AND channel_id = ${msg.channel.id} ORDER BY timestamp`,
        (err, rows) => {
          if (err) throw err;
          if (rows.length > 0) {
            for (let i = 0; i < rows.length; i++) {
              if (tryParseAndFindNumber(rows[i].message_content, 50)) {
                console.log("FOUND 50!");
              }
            }
          }
        }
      );
    } else if (command === "test") {
      getCountUser(msg.guild.id, msg.channel.id, 1, user_id => {
        console.log(user_id);
      });
    }
  }

  //Normal commands
  if (command === "ping") {
    msg.reply("Pong!");
  } else if (command === "create") {
    createUser(msg.author.id, sendMsg => {
      msg.reply(sendMsg);
    });
  }
};

const loadWatchChannels = () => {
  //Load all watching channels into DB
};

const setWatchChannel = (server_id, channel_id) => {
  //Check if server_id exists in DB
  //If not, create entry for server_id and channel_id
  //Or Update server_id to channel_id
  //Also remove old channel_id from watchChannels variable and insert the new one
  //ADMIN ONLY COMMAND
};

const deleteWatchChannel = (server_id, channel_id) => {};

const saveWatchChannels = channels => {};

const addAdmin = (server_id, user_id) => {
  //ADD ADMIN TO DB
};

const remAdmin = (server_id, user_id) => {
  //REMOVE ADMIN FROM DB
};

const loadAdmins = () => {
  //LOAD ALL ADMINS FROM DB TO admins object
};

const initializeCount = async (server_id, channel_id, client, repeatInterval) => {
    getMessages(server_id, channel_id, async (messages) => {
        let count = 1;
        if (messages.length > 0) {
        let messages_since_last_found = 0;

        //Checking each message in the DB
        for (let i = 0; i < messages.length; i++) {
          const current_db_message = messages[i];
          console.log('Current message is ', current_db_message.id)
          if (tryParseAndFindNumber(current_db_message.message_content, count)) {
              console.log('Found count ' + count + ' at message number ' + i)
              //Check if user is the last user who marked a count
              let previousUsers = await getCountUsers(server_id, channel_id, count - 1, repeatInterval, async users => {
                let shouldMark = true;
                console.log('Checking previous users')
                if (users) {
                    for (let a = 0; a < users.length; a++) {
                        let user = users[a]
                        if (user.user_id === current_db_message.user_id) {
                            //Ask admin if its ok or skip
                            let userObj = await client.fetchUser(current_db_message.user_id);
                            let message_entry = `**${userObj.tag}:** ${current_db_message.message_content}\n`;
                            let link = `https://discordapp.com/channels/${current_db_message.server_id}/${current_db_message.channel_id}/${current_db_message.message_id}\n`
                            await client.channels.get(channel_id).send(
                                `Found match for count **${count}** but the user repeat interval is wrong\n` +
                                message_entry +
                                link +
                                "Should I allow this? (Y/N) admin only"
                            );
                            const collected = await client.channels
                                .get(channel_id)
                                .awaitMessages(
                                    m => {
                                    if (!keys.ADMIN_IDS.includes(m.author.id)) return false;
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
                            shouldMark = false
                        }
                      }
                    }
                }
                
                if (shouldMark) {
                    await markMessageCount(server_id, channel_id, current_db_message.message_id, count);
                    count++;
                }
              }
            );
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
      await client.channels
          .get(channel_id)
          .send(
            "Done initializing counters!"
          );
    })
}


const getMessages = async (server_id, channel_id, callback) => {
    let messages = await query(`SELECT * FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} ORDER BY timestamp`)
    console.log(messages)
    callback(messages)
}

const checkCounter = async (server_id, channel_id, callback) => {
    console.log('Starting check counter')
  let results = await query(
    `SELECT count FROM counters WHERE server_id = ${server_id} AND channel_id = ${channel_id}`
  );
  callback(results[0].count)
};

const insertCounter = async (server_id, channel_id, count) => {
  await query(
    "INSERT INTO counters SET ?",
    {
      server_id,
      channel_id,
      count
    }
  );
};

const updateCounter = async (server_id, channel_id, count) => {
  await query(
    `UPDATE counters SET count = ${count} WHERE server_id = ${server_id} AND channel_id = ${channel_id}`
  );
};

const markMessageCount = async (server_id, channel_id, message_id, count) => {
  console.log(
    `marking message ${server_id} / ${channel_id} / ${message_id} as count ${count}`
  );
  await query(
    `UPDATE messages SET count = ${count} WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND message_id = ${message_id}`
  );

  console.log('Awaiting check counter...')
  await checkCounter(server_id, channel_id, async result => {
    if (result) {
      //NEED UPDATE
      await updateCounter(server_id, channel_id, count);
    } else {
      //NEED INSERT
      await insertCounter(server_id, channel_id, count);
    }
  });
  return
};

const getCountUsers = async (
  server_id,
  channel_id,
  count,
  repeatInterval,
  callback
) => {
  let results = await query(
    `SELECT user_id FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND count <= ${count} AND count >= ${count -
      repeatInterval} AND count > 0`
  )
  callback(results);
};

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

const getInitialLog = async channel => {
  //Delay between loops
  let before;
  let limit = 100;
  console.log("Initializing fetch in channel id " + channel.id);

  const fetchSomeMessages = async (channel, limit, before) => {
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
                await query(
                  "INSERT INTO messages SET ?",
                  {
                    message_id: message.id,
                    server_id: message.guild.id,
                    channel_id: message.channel.id,
                    user_id: message.author.id,
                    message_content: message.cleanContent,
                    timestamp: message.createdAt,
                    count: -1
                  }
                );
              }
            }
          );
        });

        //RECURSE IF MORE MESSAGES
        if (messages.array().length === limit) {
          console.log("Fetching more...");
          setTimeout(async () => {
            await fetchSomeMessages(channel, limit, newBefore);
          }, 2000);
        } else {
          console.log("DONE!");
          channel.send('Done Fetching Messages!')
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

const createUser = (id, sendMsg) => {
  //Check if user already exists
  findUser(id, user => {
    if (!user) {
      //User does not exist, create user
      //Check if message already exists
      query("INSERT INTO users SET ?", { id }, (err, res) => {
        if (err) throw err;
        connection.commit(function(err) {
          if (err) {
            connection.rollback(function() {
              throw err;
            });
          }
          console.log("ID inserted: " + id);
          sendMsg("Account created!");
        });
      });
    } else {
      sendMsg("Account already exists");
    }
  });
};

const findUser = async (id, callback) => {
  //Query MySQL for username
  let foundUser;
  await query(`SELECT * FROM users WHERE id = ${id}`, (err, rows) => {
    if (err) throw err;
    if (rows.length > 0) {
      callback(rows[0]);
    } else {
      callback(0);
    }
  });
};

// const dbCommit = async (db, console_message) => {
//     console.log('Starting dbCommit...')
//   await connection.commit(async function(err) {
//     console.log('Commit await...')
//     if (err) {
//       await connection.rollback(function() {
//         throw err;
//       });
//     }
//     console.log('Logging message')
//     if (console_message) console.log(console_message);
//   });
//   console.log('Returning from dbCommit...')
//   return
// };

client.login(keys.TOKEN);

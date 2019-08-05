const moment = require('moment')

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
        `SELECT * FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND count > 0 ORDER BY timestamp`
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
        `SELECT * FROM messages WHERE server_id = ${server_id} AND channel_id = ${channel_id} AND user_id = ${user_id} AND count > 0 ORDER BY timestamp`
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

  async getCountsByMonth(chart_type, year = new Date().getFullYear()) {
    if (!this.loaded) throw new Error('getCountsByMonth was called before loading');
    let categorizedMessages = {}
    for (let i = 0; i < 12; i++) {
      categorizedMessages[getMonth(i)] = 0
    }
    for (let i = 0; i < this.messages.length; i++) {
      if (this.messages[i].timestamp.getFullYear() === year) {
        categorizedMessages[getMonth(this.messages[i].timestamp.getMonth())] += 1
      }
    }
    //Return an object that can be passed directly into chart as data
    
    return getConfiguration(categorizedMessages, chart_type, 'Counts contributed by Month')
  }

  getCountsByHour(chart_type) {
    if (!this.loaded) throw new Error('getCountsByHour was called before loading');
    let categorizedMessages = {}
    for (let i = 0; i < 24; i++) {
      categorizedMessages[getHour(i)] = 0
    }
    for (let i = 0; i < this.messages.length; i++) {
      categorizedMessages[getHour(this.messages[i].timestamp.getHours())] += 1
    }
    //Return an object that can be passed directly into chart as data
    
    return getConfiguration(categorizedMessages, chart_type, 'Counts contributed by Hour of each Day')
  }

  getCountsByDay(chart_type) {
    if (!this.loaded) throw new Error('getCountsByDay was called before loading');
    let categorizedMessages = {}
    for (let i = 0; i < 7; i++) {
      categorizedMessages[getDay(i)] = 0
    }
    for (let i = 0; i < this.messages.length; i++) {
      categorizedMessages[getDay(this.messages[i].timestamp.getDay())] += 1
    }
    //Return an object that can be passed directly into chart as data
    
    return getConfiguration(categorizedMessages, chart_type, 'Counts contributed by Day of the Week')
  }  

  getRanksByAll() {
    //Returns an array of objects with 'usertag' and 'counts'
    if (!this.loaded) throw new Error('getRanksByAll was called before loading');
    if (this.type === 'user') throw new Error('attempted to getRanksByAll on a user stat object')
    //Loop through messages and order them as needed
    return this.getSortedUserIds(this.messages)
  }
  
  getRanksByMonth(month, year=new Date().getFullYear()) {
    //Returns an array of objects with 'usertag' and 'counts'
    if (!this.loaded) throw new Error('getRanksByMonth was called before loading');
    if (this.type === 'user') throw new Error('attempted to getRanksByMonth on a user stat object')
    // require month input as integer (1 = jan, 2 = feb, etc.)
    // include a year if needed (1/19, 2/19, etc.)
    let filtered_messages = this.messages.filter((message) => {
      return message.timestamp.getMonth() === month && message.timestamp.getFullYear() === year;
    })
    return this.getSortedUserIds(filtered_messages)
  }

  getRanksByDay(day, month=new Date().getMonth(), year = new Date().getFullYear()) {
    //Returns an array of objects with 'usertag' and 'counts'
    if (!this.loaded) throw new Error('getRanksByDay was called before loading');
    if (this.type === 'user') throw new Error('attempted to getRanksByDay on a user stat object')
    // require a date input as month/day (8/1, 8/2, etc)
    // include a year if needed (8/1/19)
    let filtered_messages = this.messages.filter((message) => {
      return message.timestamp.getDate() === day && message.timestamp.getMonth() === month && message.timestamp.getFullYear() === year;
    })
    console.log('FILTERED', filtered_messages)
    return this.getSortedUserIds(filtered_messages)
  }

  getLatestCountTime() {
    if (!this.loaded) throw new Error('getRanksByDay was called before loading');
    let latestTimes = []
    let user_id_list = []
    if (this.type === 'user') {
      //Find latest message from this.messages
      latestTimes.push([this.messages[0].user_id, this.getUserLatestCountTime(this.messages[0].user_id)])
    } else {
      for (let i = 0; i < this.messages.length; i++) {
        if (!user_id_list.includes(this.messages[i].user_id)) {
          latestTimes.push([this.messages[i].user_id, this.getUserLatestCountTime(this.messages[i].user_id)])
          user_id_list.push(this.messages[i].user_id)
        }
      }
    }
    latestTimes.sort((a,b) => {
      return a[1] > b[1];
    })

    return latestTimes;
  }

  getEarliestCountTime() {
    if (!this.loaded) throw new Error('getRanksByDay was called before loading');
    let earliestTimes = []
    let user_id_list = []
    if (this.type === 'user') {
      //Find latest message from this.messages
      earliestTimes.push([this.messages[0].user_id, this.getUserEarliestCountTime(this.messages[0].user_id)])
    } else {
      for (let i = 0; i < this.messages.length; i++) {
        if (!user_id_list.includes(this.messages[i].user_id)) {
          earliestTimes.push([this.messages[i].user_id, this.getUserEarliestCountTime(this.messages[i].user_id)])
          user_id_list.push(this.messages[i].user_id)
        }
      }
    }
    earliestTimes.sort((a,b) =>{
      return a[1] < b[1];
    })
    return earliestTimes;
    
  }

  getUserLatestCountTime(user_id) {
    let filtered_messages = this.messages.filter((message) => {
      return message.user_id === user_id
    })
    let latest_time = Math.max.apply(null, filtered_messages.map((message) => {
      return message.timestamp;
    }))
    return latest_time
  }

  getUserEarliestCountTime(user_id) {
    let filtered_messages = this.messages.filter((message) => {
      return message.user_id === user_id
    })
    let earliest_time = Math.min.apply(null, filtered_messages.map((message) => {
      return message.timestamp;
    }))
    return earliest_time
  }

  getSortedUserIds(messages) {
    let categorizedMessages = {}
    let messageArray = []
    // Construct categories
    for (let i = 0; i < messages.length;i++) {
      if (messages[i].user_id in categorizedMessages) {
        categorizedMessages[messages[i].user_id] += 1
      } else {
        categorizedMessages[messages[i].user_id] = 1
      }
    }
    // Construct sortable array
    for (var user_id in categorizedMessages) {
      messageArray.push([user_id, categorizedMessages[user_id]])
    }
    messageArray.sort((a,b) => {
      return a[1] - b[1];
    })
    return messageArray
  }
}

const getConfiguration = (dataObject, chart_type, title) => {
    const default_color = "rgba(60,204,240,0.8)"
    const default_border = "rgba(60,204,240,1)"

    let data = {}
    data.labels = Object.keys(dataObject)
    data.datasets = []
    let dataset = {}
    dataset.label = "# of Counts"
    dataset.backgroundColor = default_color
    dataset.borderColor = default_border
    dataset.data = Object.values(dataObject)
    dataset.borderWidth = 1
    data.datasets.push(dataset)
    let configuration = {}
    configuration.type = chart_type;
    configuration.data = data;
    configuration.options = getOptions(title)
    return configuration
}

const getMonth = (month) => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug','Sep', 'Oct', 'Nov', 'Dec']
  return monthNames[month]
}

const getDay = (day) => {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return dayNames[day]
}

const getHour = (hour) => {
  const hourNames = ['12AM', '1AM', '2AM', '3AM', '4AM', '5AM', '6AM',
                    '7AM', '8AM', '9AM', '10AM', '11AM', '12PM', '1PM', '2PM',
                    '3PM', '4PM', '5PM', '6PM', '7PM', '8PM', '9PM', '10PM',
                    '11PM']
  return hourNames[hour]
}

const getOptions = (title_text) => {
  return {
    title: {
      display: true,
      text: title_text
    },
    legend: {
      display: false
    },
    scales: {
      yAxes: [
        {
          scaleLabel: {
            display: true,
            labelString: '# of Counts'
          },
          ticks: {
            beginAtZero: true
          },
          gridLines: {
            color: "rgba(145, 226, 247, 0.2)",
            display: true
          }
        }
      ]
    }
  }
}

module.exports = { CountStats, getMonth, getDay, getHour }

if (process.env.NODE_ENV === 'production') { //This is set automatically by heroku
    // we are in production - return the prod set of keys
    module.exports = require('./prod');
} else {
    // we are in dev - return the dev keys
    module.exports = require('./dev');
}
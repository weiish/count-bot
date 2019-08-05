const conversions = require('./config/conversions')
const math = require('mathjs')


const tryParseAndFindNumber = (content, target) => {
    let no_space_content = content.replace(/\s/g, "");
    no_space_content = no_space_content.toLowerCase();
    console.log(no_space_content)
  
    //Try converting emojis and keywords to numbers
    const conversion_keys = Object.keys(conversions);
    for (let i = 0; i < conversion_keys.length; i++) {
      if (no_space_content.includes(conversion_keys[i])) {
        let conversion_regex = new RegExp(conversion_keys[i], "g")
        no_space_content = no_space_content.replace(
          conversion_regex,
          conversions[conversion_keys[i]]
        );
      }
    }
    console.log(no_space_content)
  
    //Try finding 'target' in content
    let targetRegex = new RegExp("s" + target + "s");
    if (targetRegex.test(no_space_content)) {
      return true;
    }
    console.log(no_space_content)
  
    //Try evaluating equations in the content to find the target
    let mathRegex = /(\d+[\+\/\*\-x])*(\d+)/g;
    let matches = no_space_content.match(mathRegex);
    if (matches) {
      for (let i = 0; i < matches.length; i++) {
        let match = matches[i].replace("x", "*");
        if (math.evaluate(match) === target) {
          return true;
        }
      }
    }
    console.log(no_space_content)
  
    return false;
  };

  console.log(tryParseAndFindNumber('Nein nein nein', 999))
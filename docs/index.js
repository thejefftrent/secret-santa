let names = [
  { name: 'Shawn', encryptedName: 'LgENHQ==', gift: 'gift_Shawn'},
  { name: 'Darla', encryptedName: 'Kx0TAg==', gift: 'gift_Darla'},
  { name: 'Greg', encryptedName: 'JBcH', gift: 'gift_Greg'},
  { name: 'Anna', encryptedName: 'NQkPFBc=' , gift: 'gift_Anna'},
  { name: 'Kai', encryptedName: 'LQsZDB0=', gift: 'gift_Kai'},
  { name: 'Braxton', encryptedName: 'LR0HAQ==', gift: 'gift_Braxton'},
  { name: 'Isla', encryptedName: 'NQAGGwo=', gift: 'gift_Isla'},
  { name: 'Jeff', encryptedName: 'MwEDAA==', gift: 'gift_Jeff'},
  { name: 'Erinn', encryptedName: 'KQQYHQ==', gift: 'gift_Erinn'},
  { name: 'Ben', encryptedName: 'NQAGHgU=', gift: 'gift_Ben'},
  { name: 'Milo', encryptedName: 'MQsbDQQ=', gift: 'gift_Milo'},
  { name: 'Erin', encryptedName: 'PQAF', gift: 'gift_Erin'},
  { name: 'Anika', encryptedName: 'MgAODRBCHg==', gift: 'gift_Anika'},
  { name: 'Edwin', encryptedName: 'LQoJAg==', gift: 'gift_Edwin'},
  { name: 'Matt', encryptedName: 'Ng4fDQ8=', gift: 'gift_Matt'},
  { name: 'Erika', encryptedName: 'KwENFw==', gift: 'gift_Erika'},
]

let gifts = {
  'Shawn': [' a new guitar!', ' concert tickets!', ' a vinyl record collection!'],
  'Darla': [' a spa day!', ' a cookbook!', ' a set of kitchen knives!'],
  'Anna': [' a novel by her favorite author!', ' a set of art supplies!', ' a cozy blanket!'],
  'Greg': [' a new set of golf clubs!', ' a smartwatch!', ' a BBQ grill!'],
  'Kai': [' a skateboard!', ' a video game!', ' a set of headphones!'],
  'Braxton': [' a drone!', ' a remote control car!', ' a LEGO set!'],
  'Isla': [' a jewelry making kit!', ' a set of fairy lights!', ' a personalized mug!'],
  'Jeff': [' a new fishing rod!', ' a camping tent!', ' a multi-tool!'],
  'Erinn': [' a yoga mat!', ' a set of essential oils!', ' a meditation app subscription!'],
  'Ben': [' a basketball!', ' a fitness tracker!', ' a new pair of sneakers!'],
  'Milo': [' a puzzle!', ' a board game!', ' a science kit!'],
  'Erin': [' a cookbook!', ' a set of baking tools!', ' a kitchen gadget!'],
  'Anika': [' a painting set!', ' a DIY craft kit!', ' a set of colored pencils!'],
  'Edwin': [' a model airplane kit!', ' a book on astronomy!', ' a telescope!'],
  'Matt': [' a new video game!', ' a gaming headset!', ' a gift card to his favorite store!'],
  'Erika': [' a fitness class pass!', ' a new water bottle!', ' a set of resistance bands!'],
}


//base 64 decode
function b64DecodeUnicode(str) {
  return decodeURIComponent(atob(str).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
}

//encrypt string based on key
function encrypt(str, key) {
  let encrypted = "";
  for (let i = 0; i < str.length; i++) {
    let char = str[i];
    let keyChar = key[i % key.length];
    let charCode = char.charCodeAt(0);
    let keyCharCode = keyChar.charCodeAt(0);
    let encryptedCharCode = charCode ^ keyCharCode;
    let encryptedChar = String.fromCharCode(encryptedCharCode);
    encrypted += encryptedChar;
  }
  return encrypted;
}

//decrypt string based on key
function decrypt(str, key) {
  return encrypt(b64DecodeUnicode(str), key);
}

function getDecodedName(name, code) {
  let encryptedName = names.find(person => person.name.toLowerCase() === name.toLowerCase()).encryptedName;
  return decrypt(encryptedName, code);
}

function getGift(name, code) {
  let gift = names.find(person => person.gift.toLowerCase() === gift.toLowerCase()).gift;
  return decrypt(gift, code);
}

function getNameOrError(name, code) {
  //check to see if name is in names list
  let nameInList = names.find(person => person.name.toLowerCase() === name.toLowerCase());
  if (nameInList) {
    let decodedName = getDecodedName(name, code);
    let personalGift = gifts[decodedName];
    //trim spaces from decoded name
    decodedName = decodedName.trim();
    //check to see if decoded name is in names list
    let decodedNameInList = names.find(person => person.name.toLowerCase() === decodedName.toLowerCase());

      if (gifts[decodedName] === undefined) {

       return `You are giving a gift to <br> <b style="font-size: 72pt">${decodedName + "<br>There are no gifts for this person!!!"}</b>`;
    }

    else if (decodedNameInList) {

      return `You are giving a gift to <br> <b style="font-size: 72pt">${decodedName} <br> they want: </b>` + "<br>" + personalGift;
    }

    return "Oops! Make sure you entered the correct code!";
  }
  return "Oops! Make sure you spelled your name correctly!";
}

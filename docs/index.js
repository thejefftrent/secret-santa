let names = [
  { name: 'Shawn', encryptedName: 'IggYHgc=' },
  { name: 'Darla', encryptedName: 'PA4b' },
  { name: 'Greg', encryptedName: 'JwAIGA==' },
  { name: 'Anna', encryptedName: 'OgYeGw==' },
  { name: 'Kai', encryptedName: 'OQAYEQ==' },
  { name: 'Braxton', encryptedName: 'LA4cAxM=' },
  { name: 'Isla', encryptedName: 'JwAIGAs=' },
  { name: 'Jeff', encryptedName: 'MRoAAQs=' },
  { name: 'Erinn', encryptedName: 'Lx0LAg==' },
  { name: 'Ben', encryptedName: 'MQscBw==' },
  { name: 'Milo', encryptedName: 'IwAADg8=' },
  { name: 'Erin', encryptedName: 'IgAHCg==' },
  { name: 'Anika', encryptedName: 'JxoPBA==' },
  { name: 'Edwin', encryptedName: 'MRAN' },
  { name: 'Matt', encryptedName: 'JA8ODhM=' },
  { name: 'Erika', encryptedName: 'Kh0PFwYODA==' }
]

let gifts = {
  'Shawn': [],
  'Darla': [],
  'Anna': [],
  'Greg': [],
  'Kai': [],
  'Braxton': [],
  'Isla': [],
  'Jeff': ["Test"],
  'Erinn': [],
  'Ben': [],
  'Milo': [],
  'Erin': [],
  'Anika': [],
  'Edwin': [],
  'Matt': [],
  'Erika': [],
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

      if (personalGift === undefined || personalGift.length === 0) {

       return `You are giving a gift to <br> <b style="font-size: 72pt">${decodedName + "<br>There are no gifts for this person!!!"}</b>`;
    } 

    else if (decodedNameInList) {

      return `You are giving a gift to <br> <b style="font-size: 72pt">${decodedName} <br> they want: </b>` + "<br><ul>" + personalGift.map(gift => `<li>${gift}</li>`).join('') + "</ul>";
    }

    return "Oops! Make sure you entered the correct code!";
  }
  return "Oops! Make sure you spelled your name correctly!";
}

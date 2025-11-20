let names = [
  { name: 'Shawn', encryptedName: 'LgENHQ==' },
  { name: 'Darla', encryptedName: 'Kx0TAg==' },
  { name: 'Greg', encryptedName: 'JBcH' },
  { name: 'Anna', encryptedName: 'NQkPFBc=' },
  { name: 'Kai', encryptedName: 'LQsZDB0=' },
  { name: 'Braxton', encryptedName: 'LR0HAQ==' },
  { name: 'Isla', encryptedName: 'NQAGGwo=' },
  { name: 'Jeff', encryptedName: 'MwEDAA==' },
  { name: 'Erinn', encryptedName: 'KQQYHQ==' },
  { name: 'Ben', encryptedName: 'NQAGHgU=' },
  { name: 'Milo', encryptedName: 'MQsbDQQ=' },
  { name: 'Erin', encryptedName: 'PQAF' },
  { name: 'Anika', encryptedName: 'MgAODRBCHg==' },
  { name: 'Edwin', encryptedName: 'LQoJAg==' },
  { name: 'Matt', encryptedName: 'Ng4fDQ8=' },
  { name: 'Erika', encryptedName: 'KwENFw==' }
]


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
    //trim spaces from decoded name
    decodedName = decodedName.trim();
    //check to see if decoded name is in names list
    let decodedNameInList = names.find(person => person.name.toLowerCase() === decodedName.toLowerCase());
    if (decodedNameInList) {

      return `You are giving a gift to <br> <b style="font-size: 72pt">${decodedName}</b>`;
    }
    return "Oops! Make sure you entered the correct code!";
  }
  return "Oops! Make sure you spelled your name correctly!";
}
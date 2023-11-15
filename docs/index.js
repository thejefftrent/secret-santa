let names = [
  { name: 'Shawn', encryptedName: 'IRcL' },
  { name: 'Darla', encryptedName: 'KBQd' },
  { name: 'Erika', encryptedName: 'PgAAAw==' },
  { name: 'Greg', encryptedName: 'IxoEAxo=' },
  { name: 'Anna', encryptedName: 'LwQBAw==' },
  { name: 'Kai', encryptedName: 'IxMHHwA=' },
  { name: 'Braxton', encryptedName: 'IhQcAhg=' },
  { name: 'Isla', encryptedName: 'JAIMDAA=' },
  { name: 'Matt', encryptedName: 'IBMOCxw=' },
  { name: 'Jeff', encryptedName: 'Lg0RAg==' },
  { name: 'Erinn', encryptedName: 'KQ8eEQ==' },
  { name: 'Ben', encryptedName: 'JgAMDw==' },
  { name: 'Milo', encryptedName: 'PhweFQ==' },
  { name: 'Erin', encryptedName: 'MB0XEw==' },
  { name: 'Anika', encryptedName: 'LgcCEw1CHQ==' }
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
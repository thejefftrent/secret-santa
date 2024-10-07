let families = {
  shawn: {name: "Shawn", members: []},
  greg: {name: "Greg", members: []},
  jeff: {name: "Jeff", members: []},
  erin: {name: "Erin", members: []},
  anika: {name: "Anika", members: []},
  matt: {name: "Matt", members: []},
  erika: {name: "Erika", members: []}
}

const christmasAdjectives = [
  "adorable",
  "amazing",
  "beautiful",
  "brave",
  "bright",
  "calm",
  "caring",
  "charming",
  "clever",
  "cool",
  "creative",
  "cute",
  "dazzling",
  "delightful",
  "determined",
  "diligent",
  "dreamy",
  "eager",
  "elegant",
  "energetic",
  "excellent",
  "excited",
  "exotic",
  "fabulous",
  "fancy",
  "fantastic",
  "fierce",
  "friendly",
  "funny",
  "generous",
  "gentle",
  "glowing",
  "good",
  "graceful",
  "great",
  "happy",
  "healthy",
  "helpful",
  "honest",
  "honorable",
  "impressive",
  "incredible",
  "jolly",
  "joyful",
  "kind",
  "lovely",
  "lucky",
  "nice",
  "perfect",
  "polite",
  "pretty",
  "proud",
  "radiant",
  "romantic",
  "silly",
  "smart",
  "special",
  "splendid",
  "successful",
  "super",
  "talented",
  "terrific",
  "tough",
  "tremendous",
  "trusty",
  "unusual",
  "valiant",
  "victorious",
  "wonderful",
  "worthy",
  "zealous",
  "zany"
]

const christmasWords = [
  "Christmas",
  "Holiday",
  "Winter",
  "Snow",
  "Santa",
  "Gift",
  "Stocking",
  "Mistletoe",
  "CandyCane",
  "Elf",
  "Reindeer",
  "Snowman",
  "Penguin",
  "Gingerbread",
  "PineTree",
  "Snowflake",
  "Ornament",
  "Wreath",
  "Candle",
  "Peace",
  "Love",
  "Family",
  "Friends",
  "Gifts",
  "Giving",
  "Faith",
  "Hope",
]

function person(name, family) {
  let person = {name: name, family: family};
  family.members.push(person);
  return person;
}

person("Shawn", families.shawn);
person("Darla", families.shawn);
person("Erika", families.shawn);

person("Greg", families.greg);
person("Anna", families.greg);
person("Kai", families.greg);
person("Braxton", families.greg);
person("Isla", families.greg);

person("Matt", families.matt);

person("Jeff", families.jeff);
person("Erinn", families.jeff);
person("Ben", families.jeff);
person("Milo", families.jeff);

person("Erin", families.shawn);

person("Anika", families.anika);
person("Kenzie", families.anika);
person("Edwin", families.anika);

let people = [...families.shawn.members, ...families.greg.members, ...families.jeff.members, ...families.erin.members, ...families.anika.members, ...families.matt.members, ...families.erika.members];

//shuffle people
// for (let i = people.length - 1; i > 0; i--) {
//   const j = Math.floor(Math.random() * (i + 1));
//   [people[i], people[j]] = [people[j], people[i]];
// }

function getRandomCode() {
  //get random adjective
  let adjective = christmasAdjectives[Math.floor(Math.random() * christmasAdjectives.length)];
  //get random word
  let word = christmasWords[Math.floor(Math.random() * christmasWords.length)];
  //concatenate
  let code = adjective + '-' + word;
  // lowercase
  code = code.toLowerCase();
  //remove spaces
  code = code.replace(/\s/g, '');
  return code;
}

// give each person a code
for (let person of people) {
  person.code = getRandomCode();
}

// assign a person to each person, but not themselves or their family, or someone who already has a person
for (let person of people) {
  let possiblePeople = people.filter(p => p !== person && p.family !== person.family && !p.gifted);
  let randomPerson = possiblePeople[Math.floor(Math.random() * possiblePeople.length)];
  randomPerson.gifted = true;
  person.giftTo = randomPerson;
}


//print and all people and their giftTo person
// for (let person of people) {
//   console.log(person.name + " is giving a gift to " + person.giftTo.name);
// }

//base 64 encode
function b64EncodeUnicode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function toSolidBytes(match, p1) {
    return String.fromCharCode('0x' + p1);
  }));
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

function b64encrypt(str, key) {
  return b64EncodeUnicode(encrypt(str, key));
}

//decrypt string based on key
function decrypt(str, key) {
  return encrypt(b64DecodeUnicode(str), key);
}

//encrypt all giftTo names based on code
for (let person of people) {
  //pad name with spaces to make it 20 characters
  let paddedName = person.giftTo.name.padEnd(20, " ");
  person.encryptedName = b64encrypt(person.giftTo.name, person.code);
}

for (let person of people) {
  console.log(person.name + " is giving a gift to " + decrypt(person.encryptedName, person.code));
}

//create list of all people and their encrypted name and code
let listEncrypt = people.map(person => {
  return {name: person.name, encryptedName: person.encryptedName}
});

let listCode = people.map(person => {
  return {name: person.name, code: person.code}
});

let listName = people.map(person => {
  return {name: person.name, giftTo: person.giftTo.name}
});

//copy and use in website
console.log(listEncrypt);

//copy and manually distribute
console.log(listCode);

//save to file as backup in case something goes wrong
let fs = require('fs');

fs.writeFile("secretlist.json", JSON.stringify(listName), function(err) {
  if(err) {
    return console.log(err);
  }
  console.log("The file was saved!");
});

fs.writeFile("codelist.json", JSON.stringify(listCode), function(err) {
  if(err) {
    return console.log(err);
  }
  console.log("The file was saved!");
});
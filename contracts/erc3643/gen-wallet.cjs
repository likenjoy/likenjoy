const crypto = require("crypto");
const { secp256k1 } = require("ethereum-cryptography/secp256k1");
const { keccak256 } = require("ethereum-cryptography/keccak");
const { bytesToHex } = require("ethereum-cryptography/utils");

const privKey = crypto.randomBytes(32);
const privKeyHex = "0x" + privKey.toString("hex");

const pubKey = secp256k1.getPublicKey(privKey, false);
const pubKeyNoPrefix = pubKey.slice(1);
const hash = keccak256(pubKeyNoPrefix);
const address = "0x" + bytesToHex(hash.slice(-20));

console.log("PRIVATE_KEY=" + privKeyHex);
console.log("ADDRESS=" + address);

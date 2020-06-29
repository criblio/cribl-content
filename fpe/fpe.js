const crypto = require('crypto');
const digits = '1234567890.'.split('');

module.exports = function({
    password="password use to generate key",
    algorithm = 'aes-192-cbc',
    key = crypto.scryptSync(password, 'salt', 24),
    iv = Buffer.alloc(16,0),
    domain = digits
}) {

    function enc(text) {
	const cipher = crypto.createCipheriv(algorithm, key, iv);
	let encrypted = cipher.update(text, 'utf8', 'hex');
	encrypted += cipher.final('hex')
	return encrypted; 
    }

  // create a permutation of domain
  const sorted = domain
    .map(c => c)
    .sort((c1, c2) => enc(c1).localeCompare(enc(c2)));
  const encTable = {};
  const decTable = {};

  for (let i in domain) {
    encTable[domain[i]] = sorted[i];
    decTable[sorted[i]] = domain[i];
  }

  function validate(text, result) {
    if (text.length !== result.length) {
      throw new Error(
        `some of the input characters are not in the cipher's domain: [${domain}]`
      );
    }
  }

  function encrypt(text) {
    if (typeof text !== 'string') {
      throw new Error('input is not a string');
    }
    const encrypted = text
      .split('')
      .map(c => encTable[c])
      .join('');
    validate(text, encrypted);
    return encrypted;
  }

  function decrypt(text) {
    if (typeof text !== 'string') {
      throw new Error('input is not a string');
    }
    const decrypted = text
      .split('')
      .map(c => decTable[c])
      .join('');
    validate(text, decrypted);
    return decrypted;
  }

  return { encrypt, decrypt };
};

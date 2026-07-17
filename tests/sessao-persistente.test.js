const fs = require('fs');
const assert = require('assert');

const auth = fs.readFileSync('api/_auth.js', 'utf8');

assert.ok(auth.includes('30 * 24 * 60 * 60 * 1000'), 'sessao do app deve durar 30 dias');
console.log('sessao-persistente.test.js passou');

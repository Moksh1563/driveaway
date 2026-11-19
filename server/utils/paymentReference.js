const crypto = require('crypto');

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** A payment reference for an online payment: 'pay_' followed by 14 random letters and digits. */
const paymentReference = () => `pay_${Array.from(crypto.randomBytes(14), (b) => BASE62[b % 62]).join('')}`;

module.exports = { paymentReference };

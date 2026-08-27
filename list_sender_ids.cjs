const crypto = require('crypto');
const https = require('https');

const apiKey = 'sk_Y8rB4E2PzMMOQZ3LyCbf8xYKw1tjniyhae85NX3IxKgLx6GD';
const apiSecret = 'CDwwiiKKta44Q16R4u0O4jZgHVnhmnRivl7SrIYgdbeRSKJ3Z8Q7JoaSqe07miWf';
const timestamp = Math.floor(Date.now() / 1000);
const method = 'GET';
const path = '/api/v1/sender-ids';
const body = '';

const payload = `${timestamp}\n${method}\n${path}\n${body}`;
const signature = crypto.createHmac('sha256', apiSecret)
    .update(payload)
    .digest('hex');

const options = {
    hostname: 'sms.ehub.co.tz',
    port: 443,
    path: path,
    method: method,
    headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Timestamp': timestamp.toString(),
        'X-Signature': signature,
        'Accept': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log(data);
    });
});

req.on('error', (e) => {
    console.error(e);
});

req.end();

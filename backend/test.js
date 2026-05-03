const axios = require('axios');

async function testBackend() {
    try {
        const res = await axios.get('http://localhost:5000/api/threats');
        print("Backend Status:", res.status);
    } catch (err) {
        console.error("Test Failed:", err.message);
    }
}
testBackend();

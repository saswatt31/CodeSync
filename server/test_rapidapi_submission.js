const axios = require("axios");

async function test() {
  try {
    const options = {
      method: 'POST',
      url: 'https://judge0-ce.p.rapidapi.com/submissions',
      params: { base64_encoded: 'false', wait: 'true', fields: '*' },
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': '48b0923856mshad70c082f814741p11e90ajsncd2edb438a4e',
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
      },
      data: {
        language_id: 93,
        source_code: "console.log('test');"
      }
    };
    const res = await axios.request(options);
    console.log("Success!", res.data);
  } catch (err) {
    console.error("Failed:", err.response ? err.response.data : err.message);
  }
}
test();

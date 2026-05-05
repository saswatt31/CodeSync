const axios = require("axios");

async function test() {
  try {
    const res = await axios.post("http://localhost:5000/api/execute/run", {
      code: "console.log('Hello');",
      language: "javascript",
      sessionId: "123"
    }, {
      // Need a valid token to bypass protect middleware, or just bypass it for testing.
    });
    console.log(res.data);
  } catch (err) {
    console.log(err.message);
  }
}
// Actually, since there's protect middleware, I can't easily test it directly like this without a token.

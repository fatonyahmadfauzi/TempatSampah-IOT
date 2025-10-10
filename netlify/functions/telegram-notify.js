exports.handler = async function(event) {
    console.log("Telegram notification triggered:", event.body);
    return { statusCode: 200, body: JSON.stringify({ success: true, message: "Telegram notification received." }) };
};
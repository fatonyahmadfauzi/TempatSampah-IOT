exports.handler = async function(event) {
    console.log("Discord notification triggered:", event.body);
    return { statusCode: 200, body: JSON.stringify({ success: true, message: "Discord notification received." }) };
};
var express = require("express");
var request = require("request");
var bodyParser = require("body-parser");

var apiai = require('apiai');

var ai = apiai("API_AI_TOKEN");
var datamuse = require('datamuse');


//VARIABLES --- CREATE A DATA STRUCTURE FOR MORE USERS LATER ON
var number = 0;
var tag = "";

//Facebook
var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));

// Server index page
app.get("/", function (req, res) {
    res.send("Deployed!");
});


app.get("/webhook", function (req, res) {
    if (req.query["hub.verify_token"] === "WEB_HOOK_TOKEN") {
        console.log("Verified webhook");
        res.status(200).send(req.query["hub.challenge"]);
    } else {
        console.error("Verification failed. The tokens do not match.");
        res.sendStatus(403);
    }
});


app.post("/webhook", function (req, res) {
    // Make sure this is a page subscription
    if (req.body.object == "page") {
        // Iterate over each entry
        // There may be multiple entries if batched
        req.body.entry.forEach(function (entry) {
            // Iterate over each messaging event
            entry.messaging.forEach(function (event) {
                if (event.postback) {
                    processPostback(event);
                } else if (event.message) {
                    processMessage(event);
                }
            });
        });

        res.sendStatus(200);
    }
});


//Generic Messages
function processMessage(event) {
    if (!event.message.is_echo) {
        var message = event.message;
        var senderId = event.sender.id;

        console.log("Received message from senderId: " + senderId);
        console.log("Message is: " + JSON.stringify(message));


        var messageText = message.text.toLowerCase();

        //Message sent to API.AI
        var request = ai.textRequest(messageText, {
            sessionId: 'tip_of_my_tongue'
        });

        request.on('response', function (response) {

            //For unknown inputs and small-talk
            if (response.result.action == "input.unknown" || response.result.action.includes("smalltalk")) {

                //Post the message sent as response
                sendMessage(senderId, {text: response.result.fulfillment.speech});

            } else if (response.result.action == "SimilarMeaning") {

                //Find Similar Meaning
                var word = response.result.parameters.intent.replace(" ", "+");
                tag = tag + "&ml=" + word;
                number = 0;
                findWord(senderId);

            } else if (response.result.action == "StartsWith") {

                //For Starting Letter
                var word = response.result.parameters.intent.replace(" ", "+");
                tag = tag + "&sp=" + word + "*";
                number = 0;
                findWord(senderId);

            } else if (response.result.action == "Associated") {

                //For word Associations
                var word = response.result.parameters.intent.replace(" ", "+");
                tag = tag + "&rel_trg=" + word;
                number = 0;
                findWord(senderId);

            } else if (response.result.action == "Describes") {

                //For word descriptions
                var word = response.result.parameters.intent.replace(" ", "+");
                tag = tag + "&rel_jjb=" + word;
                number = 0;
                findWord(senderId);

            } else if (response.result.action == "EndsWith") {

                //For ending letter
                var word = response.result.parameters.intent.replace(" ", "+");
                tag = tag + "&sp=" + "*" + word;
                number = 0;
                findWord(senderId);

            } else if (response.result.action == "RhymesWith") {

                //For rhyming words
                var word = response.result.parameters.intent.replace(" ", "+");
                tag = tag + "&rel_rhy=" + word;
                number = 0;
                findWord(senderId);

            } else if (response.result.action == "SoundsSimilar") {

                //For similar sounds
                var word = response.result.parameters.intent.replace(" ", "+");
                tag = tag + "&sl=" + word;
                number = 0;
                findWord(senderId);

            } else if (response.result.action == "SpelledSimilar") {

                //for similar spellings
                var word = response.result.parameters.intent.replace(" ", "+");
                tag = tag + "&sp=" + word;
                number = 0;
                findWord(senderId);
            }


        });

        //If error just post the error
        request.on('error', function (error) {
            console.log(error);
        });

        request.end();

    }
}


//Interacting with Datamuse API to find words

function findWord(userId) {

    var request = require('request');
    console.log(tag);

    request('https://api.datamuse.com/words?' + tag, function (error, response, body) {
        if (!error && response.statusCode == 200) {

            //Parsing the array returned as a JSON object for simpler usage
            body = JSON.parse(body);
            console.log(body);

            //for empty array returned or words no longer available
            if (body.length == 0 || body.length < number) {

                message1 = {
                    attachment: {
                        type: "template",
                        payload: {
                            template_type: "button",
                            text: "No words found. Try again",
                            buttons: [{
                                type: "postback",
                                title: "Try a New Word",
                                payload: "New Word"
                            }]

                        }
                    }
                };

                sendMessage(userId, message1);
                return;

            }

            var msg = "";

            var end = 0;

            //End condition
            if (body.length <= number + 10)
                end = body.length; //If less than 10 words are available in list
            else
                end = number + 10;


            for (var i = number; i < end; i++) {
                msg = msg + body[i].word + "\n";
            }

            console.log(msg);

            number = end;


            message = {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: "Is it one of the following words? \n\n" + msg,
                        buttons: [{
                            type: "postback",
                            title: "Yes",
                            payload: "Correct"
                        }, {
                            type: "postback",
                            title: "No",
                            payload: "Incorrect"
                        }, {
                            type: "postback",
                            title: "Try a New Word",
                            payload: "New Word"
                        }]

                    }
                }
            };

            sendMessage(userId, message);

        }
    })


}


//When a button is clicked

function processPostback(event) {
    var senderId = event.sender.id;
    var payload = event.postback.payload;

    if (payload === "Greeting") {
        // Get user has clicked get started button
        request({
            url: "https://graph.facebook.com/v2.6/" + senderId,
            qs: {
                access_token: process.env.PAGE_ACCESS_TOKEN,
                fields: "first_name"
            },
            method: "GET"
        }, function (error, response, body) {
            var greeting = "";
            if (error) {
                console.log("Error getting user's name: " + error);
            } else {
                var bodyObj = JSON.parse(body);
                name = bodyObj.first_name;
                greeting = "Hi " + name + ". ";
            }

            //Greeting message sent incase the user presses Get Started
            var message = greeting + "I know how it feels when you have a word on the tip of your tongue and you just cannot seem to remember! Let me help you find it...Try phrases like " +
                "\nThe word begins with... \nThe word means... \nThe word rhymes with...\nThe word is spelt similar to...\nThe word describes...\n" +
                "The word is strongly associated with...\nThe word ends with...\nThe word sounds similar to... etc..";
            sendMessage(senderId, {text: message});
        });

    } else if (payload == "Correct") {

        //Message sent if the user finds the word that he needs and gives him an option to find another word
        message1 = {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: "I am glad I could help you",
                    buttons: [{
                        type: "postback",
                        title: "Try a New Word",
                        payload: "New Word"
                    }]

                }
            }
        };

        sendMessage(senderId, message1);

        //Deleting data and variables start from zero again
        number = 0;
        tag = "";

    } else if (payload == "Incorrect") {

        //Find the next set of 10 words
        findWord(senderId);

    } else if (payload == "New Word") {

        //User wants to start a new search
        number = 0;
        tag = "";

        sendMessage(senderId, {
            text: "Let's find that word! Try phrases like " +
            "\nThe word begins with... \nThe word means... \nThe word rhymes with...\nThe word is spelt similar to...\nThe word describes...\n" +
            "The word is strongly associated with...\nThe word ends with...\nThe word sounds similar to... etc.."
        });

    }
}


// sends FB message to user
function sendMessage(recipientId, message) {
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: "POST",
        json: {
            recipient: {id: recipientId},
            message: message,
        }
    }, function (error, response, body) {
        if (error) {
            console.log("Error sending message: " + response.error);
        }
    });

}

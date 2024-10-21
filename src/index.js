import dotenv from "dotenv";
import fs from "fs";
import csv from "csv-parser";
import { Client, IntentsBitField, EmbedBuilder } from "discord.js";

dotenv.config();

// !Initialize Variables
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});

let bonkLoginToken = ""; // Maybe Encapsulate this in a class later

// !My functions
// Retrieves Room Data
const bonkGetRoomsJSON = async () => {
    try {
        const fetchRoomURL = "https://bonk2.io/scripts/getrooms.php";

        const fetchRoomHeaders = {
            accept: "*/*",
            "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "sec-ch-ua": '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            Referer: "https://bonk.io/",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        };

        const fetchRoomData = `version=49&gl=n&token=${bonkLoginToken}`;

        const response = await fetch(fetchRoomURL, {
            headers: fetchRoomHeaders,
            body: fetchRoomData,
            method: "POST",
        });

        const responseJSON = await response.json();
        return responseJSON;
    } catch (err) {
        console.error("bonkGetRoomsJSON() failed:", err);
        throw err;
    }
};

// Get new login token if expired(using remember token)
const getNewBLT = async () => {
    try {
        const fetchRoomURL = "https://bonk2.io/scripts/login_auto.php";

        const fetchRoomHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/113.0",
            Accept: "*/*",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Origin: "https://bonk.io",
            Connection: "keep-alive",
            Referer: "https://bonk.io/",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "cross-site",
            TE: "trailers",
        };

        const fetchRoomData = `rememberToken=${process.env.LB_Bot_RMBTOKEN}`;

        const response = await fetch(fetchRoomURL, {
            headers: fetchRoomHeaders,
            body: fetchRoomData,
            method: "POST",
        });

        const responseJSON = await response.json();
        return responseJSON.token;
    } catch (err) {
        console.error("getNewBLT() failed", err);
        throw err;
    }
};

const stringLevDistance = (a, b) => {
    if (!a || !b) return (a || b).length;

    const matrix = [];

    // Increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // Increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
};

// Print those infos in the channel
const printBonkPkrRooms = (roomsJSON) => {
    if (!roomsJSON || !roomsJSON.rooms) {
        throw new Error("Invalid rooms data");
    }
    
    let roomsArray = roomsJSON.rooms;

    let roomsEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Live Bonk Parkour Rooms:")
        .setTimestamp();

    let numRooms = 0; // Initialize the room counter
    const maxDistance = 4; // Set a threshold for Levenshtein distance
    
    for (let room of roomsArray) {
        const roomName = room.roomname.toLowerCase();
        
        const lengthDifference = Math.abs(roomName.length - 7);
        if (lengthDifference > maxDistance && !roomName.includes("parkour")) {
            continue; // Skip this room
        }
        
        const distance = stringLevDistance(roomName, targetWord);
        
        if (distance <= maxDistance || roomName.includes("parkour")) {
            numRooms++; // Increment the room counter
            
            const modeMapping = {
                b: "Classic",
                ar: "Arrows",
                ard: "Death Arrows",
                sp: "Grapple",
                f: "Football",
                bs: "Simple",
                v: "VTOL",
            };
            
            let mode = modeMapping[room.mode_mo] || "Classic";
            
            let password = room.password === 1 ? "Yes" : "No";

            roomsEmbed.addFields({
                name: `Room Name: ${room.roomname}`,
                value: `Mode: ${mode}\nPlayers: ${room.players}/${room.maxplayers}\nLevel Require: ${room.minlevel}-${room.maxlevel}\nCountry: ${room.country}\nPassword: ${password}`,
            });
        }
    }

    if (numRooms == 0) {
        roomsEmbed.addFields({
            name: "No Parkour rooms available at the moment",
            value: "Please check back later :D",
        });
    }

    return { embed: roomsEmbed, numRooms }; // Return both the embed and number of rooms
};

// send bonk info to discord
const sendBonkInfo = async () => {
    // Schedule the next update at first
    setTimeout(sendBonkInfo, 10000); // too fast and the bot will get rate-limited by the bonk.io server
    
    let updateMsg = "Sending Rooms Info to Discord ";
    
    const now = new Date();
    console.log(updateMsg.concat(now.getHours(), ":", now.getMinutes(), ":", now.getSeconds()));

    let roomsEmbed;
    let numRooms = 0; // Initialize the room count

    try {
        let roomsJSON = await bonkGetRoomsJSON();
        
        if (!roomsJSON) {
            console.error("Rooms JSON is undefined or null.");
            return;
        }
        
        if (roomsJSON.r === "fail" && roomsJSON.e === "token") {
            console.log("Token Expired, trying to get a new one...");
            bonkLoginToken = await getNewBLT();
            console.log("New token obtained, retrying room data fetch...");
            roomsJSON = await bonkGetRoomsJSON();
        }
        
        // Destructure the returned object to get the embed and number of rooms
        const result = printBonkPkrRooms(roomsJSON);
        roomsEmbed = result.embed;
        numRooms = result.numRooms;
    } catch (err) {
        console.error("failed getting bonk rooms", err);
    }

    try {
        const channel = client.channels.cache.get("1122510728331542579"); // Maybe storing in a config file would be better
        const message = await channel.messages.fetch("1233387458142666853");
        // channel.send({ embeds: [roomsEmbed] }); // Use this to send a new message
        message.edit({ embeds: [roomsEmbed] });
        
        // Update the channel name with the number of rooms
        if (numRooms === 1) {
            await channel.edit({ name: `🚪┊〔${numRooms}〕ʀᴏᴏᴍ` });
        } else {
            await channel.edit({ name: `🚪┊〔${numRooms}〕ʀᴏᴏᴍs` });
        }
    } catch (err) {
        console.error("failed sending bonk info to discord", err);
    }
};

// Function to get random map based on optional filters
const getRandomMap = async (authorName, mode, bonkVersion, tags) => {
    return new Promise((resolve, reject) => {
        const results = [];

        fs.createReadStream("src/mapList.csv") // Update path accordingly
            .pipe(csv())
            .on("data", (data) => results.push(data))
            .on("end", () => {
                // Filter records based on the input parameters
                const filteredMaps = results.filter((map) => {
                    return (
                        (!authorName || map["Mapmaker Name"].toLowerCase() === authorName.toLowerCase()) &&
                        (!mode || map["Mode"].toLowerCase() === mode.toLowerCase()) &&
                        (!bonkVersion || map["Bonk Version"].toLowerCase() === bonkVersion.toLowerCase())
                    );
                });

                // Select a random map from filtered maps
                if (filteredMaps.length > 0) {
                    const randomMap = filteredMaps[Math.floor(Math.random() * filteredMaps.length)];
                    resolve({
                        name: randomMap["Map Name"],
                        author: randomMap["Mapmaker Name"],
                        mode: randomMap["Mode"],
                        version: randomMap["Bonk Version"],
                    });
                } else {
                    resolve("No maps found with the specified filters.");
                }
            })
            .on("error", (err) => {
                reject(err);
            });
    });
}

// !Discord Bot Functions
client.on("ready", (c) => {
    console.log(`${c.user.username} is online.`);

    sendBonkInfo();
});

client.on("messageCreate", (msg) => {
    if (msg.author.bot) {
        return;
    }

    if (msg.channelId != "1091404236182536284") {
        return;
    }

    // ?Things to deal with messages in channel can go here
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) {
        return;
    }

    if (interaction.commandName === "oi") {
        await interaction.reply("Oi!");
    }

    if (interaction.commandName === "random-map") {
        const authorName = interaction.options.getString("author-name") || null;
        const mode = interaction.options.getString("mode") || null;
        const bonkVersion = interaction.options.getString("bonk-version") || null;
        const tags = interaction.options.getString("tags") || null;

        try {
            const mapDetails = await getRandomMap(authorName, mode, bonkVersion, tags);

            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle(mapDetails.name) // Set only the map name as the title
                .addFields(
                    { name: "Author", value: mapDetails.author, inline: true },
                    { name: "Mode", value: mapDetails.mode, inline: true },
                    { name: "Bonk Version", value: mapDetails.version, inline: true }
                );

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error(err);
            await interaction.reply("There was an error trying to execute that command!");
        }
    }
});

client.login(process.env.BOT_TOKEN); // Let the discord bot login

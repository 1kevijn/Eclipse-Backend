const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../Config/config.json');
const log = require("./log.js");
const FormData = require('form-data');
const webhook = config.bItemShopWebhook; 
const fortniteapi = "https://fortnite-api.com/v2/cosmetics/br";
const catalogcfg = path.join(__dirname, "..", 'Config', 'catalog_config.json');

const chapterlimit = config.bChapterlimit; 
const seasonlimit = config.bSeasonlimit; 
const dailyItemsCount = config.bDailyItemsAmount;
const featuredItemsCount = config.bFeaturedItemsAmount;

async function fetchitems() {
    try {
        const response = await axios.get(fortniteapi);
        const cosmetics = response.data.data || [];
        const excludedItems = config.bExcludedItems || [];

        const maxChapter = parseInt(config.bChapterlimit, 10);
        const maxSeason = parseInt(config.bSeasonlimit, 10);

        return cosmetics.filter(item => {
            const { id, introduction, rarity } = item;

            if (!id || !introduction || !rarity) return false;
            if (!introduction.chapter || !introduction.season) return false;

            const chapter = parseInt(introduction.chapter, 10);
            const season = parseInt(introduction.season, 10);
            const itemRarity = rarity.displayValue?.toLowerCase();

            // Exclude unwanted items (common rarity, excluded by ID)
            if (excludedItems.includes(id)) return false;
            if (itemRarity === "common") return false;

            // Exclude Chapter Remix items
            // Adjust this based on the way Chapter Remix items are tagged
            if (id.toLowerCase().includes("remix") || (introduction.chapter?.toLowerCase().includes("remix") || introduction.season?.toLowerCase().includes("remix"))) {
                return false;
            }

            // Filter by chapter and season
            if (chapter > maxChapter || chapter < maxChapter) return false; // Only allow Chapter 2

            // Chapter is equal, so check season
            if (season > maxSeason) return false;

            return true;
        });
    } catch (error) {
        log.error('Error fetching cosmetics:', error.message || error);
        return [];
    }
}


function pickRandomItems(items, count) {
    const itemTypeBuckets = {
        athenaCharacter: [],
        athenaDance: [],
        athenaBackpack: [],
        athenaGlider: [],
        athenaPickaxe: [],
        loadingScreen: [],
        emoji: []
    };

    items.forEach(item => {
        const type = item.type?.value.toLowerCase();
        switch (type) {
            case "outfit":
                itemTypeBuckets.athenaCharacter.push(item);
                break;
            case "emote":
                itemTypeBuckets.athenaDance.push(item);
                break;
            case "backpack":
                itemTypeBuckets.athenaBackpack.push(item);
                break;
            case "glider":
                itemTypeBuckets.athenaGlider.push(item);
                break;
            case "pickaxe":
                itemTypeBuckets.athenaPickaxe.push(item);
                break;
            case "loadingscreen":
                itemTypeBuckets.loadingScreen.push(item);
                break;
            case "emoji":
                itemTypeBuckets.emoji.push(item);
                break;
            default:
                break;
        }
    });

    const selectedItems = [];

    function addItemsFromBucket(bucket, requiredCount) {
        const availableItems = bucket.sort(() => 0.5 - Math.random()).slice(0, requiredCount);
        selectedItems.push(...availableItems);
    }

    addItemsFromBucket(itemTypeBuckets.athenaCharacter, Math.min(2, count));
    addItemsFromBucket(itemTypeBuckets.athenaDance, Math.min(1, count));
    addItemsFromBucket(itemTypeBuckets.athenaBackpack, Math.min(1, count));
    addItemsFromBucket(itemTypeBuckets.athenaGlider, Math.min(1, count));
    addItemsFromBucket(itemTypeBuckets.athenaPickaxe, Math.min(1, count));
    addItemsFromBucket(itemTypeBuckets.loadingScreen, Math.min(1, count));
    addItemsFromBucket(itemTypeBuckets.emoji, Math.min(1, count));

    const remainingCount = count - selectedItems.length;
    const remainingItems = items.filter(item => !selectedItems.includes(item));

    const extraItems = remainingItems.sort(() => 0.5 - Math.random()).slice(0, remainingCount);
    selectedItems.push(...extraItems);

    return selectedItems.slice(0, count);
}

function formatitemgrantsyk(item) {
    const { id, backendValue, type } = item;
    let itemType;

    switch (type.value.toLowerCase()) {
        case "outfit":
            itemType = "AthenaCharacter";  
            break;
        case "emote":
            itemType = "AthenaDance";  
            break;
        default:
            itemType = backendValue || `Athena${capitalizeomg(type.value)}`;
            break;
    }

    return [`${itemType}:${id}`];
}

function capitalizeomg(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function notproperpricegen(item) {
    const rarity = item.rarity?.displayValue?.toLowerCase();
    const type = item.type?.value?.toLowerCase();
    const series = item.series?.value?.toLowerCase();

    if (series) {
        switch (series) {
            case 'gaming legends series':
            case 'marvel series':
            case 'star wars series':
            case 'dc series':
            case 'icon series':
                switch (type) {
                    case 'outfit':
                        return 1500;
                    case 'pickaxe':
                        return 1200;
                    case 'backpack':
                        return 1200;
                    case 'emote':
                        return 500;
                    case 'glider':
                        return 1200;
                    case 'wrap':
                        return 700;
                    case 'loadingscreen':
                        return 500;
                    case 'music':
                        return 200;
                    case 'emoji':
                        return 200;
                    default:
                        return 999999;
                }
            case 'lava series':
                switch (type) {
                    case 'outfit':
                    case 'glider':
                    case 'backpack':
                        return 2000;
                    case 'pickaxe':
                        return 1200;
                    case 'loadingscreen':
                        return 500;
                    case 'music':
                        return 200;
                    case 'emoji':
                        return 200;
                    default:
                        return 999999;
                }
            case 'shadow series':
            case 'frozen series':
            case 'slurp series':
            case 'dark series':
                switch (type) {
                    case 'outfit':
                        return 1500;
                    case 'pickaxe':
                        return 1200;
                    case 'backpack':
                        return 1200;
                    case 'glider':
                        return 1200;
                    case 'wrap':
                        return 700;
                    case 'loadingscreen':
                        return 500;
                    case 'music':
                        return 200;
                    case 'emoji':
                        return 200;
                    default:
                        return 999999;
                }
            default:
                return 999999;
        }
    }

    switch (type) {
        case 'outfit':
            switch (rarity) {
                case 'legendary':
                    return 1200;
                case 'epic':
                    return 1000;
                case 'rare':
                    return 900;
                case 'uncommon':
                    return 800;
                default:
                    return 999999;
            }
        case 'pickaxe':
            switch (rarity) {
                case 'epic':
                    return 1100;
                case 'rare':
                    return 800;
                case 'uncommon':
                    return 500;
                default:
                    return 999999;
            }
        case 'backpack':
            switch (rarity) {
                case 'legendary':
                    return 1500;
                case 'epic':
                    return 1200;
                case 'rare':
                    return 800;
                case 'uncommon':
                    return 200;
                default:
                    return 999999;
            }
        case 'emote':
        case 'spray':
        case 'emoji':
            switch (rarity) {
                case 'legendary':
                    return 1500;
                case 'epic':
                    return 800;
                case 'rare':
                    return 500;
                case 'uncommon':
                    return 200;
                default:
                    return 999999;
            }
        case 'glider':
            switch (rarity) {
                case 'legendary':
                    return 1500;
                case 'epic':
                    return 1200;
                case 'rare':
                    return 800;
                case 'uncommon':
                    return 500;
                default:
                    return 999999;
            }
        case 'wrap':
            switch (rarity) {
                case 'legendary':
                    return 900;
                case 'epic':
                    return 700;
                case 'rare':
                    return 500;
                case 'uncommon':
                    return 300;
                default:
                    return 999999;
            }
        case 'loadingscreen':
            switch (rarity) {
                case 'legendary':
                case 'epic':
                case 'rare':
                    return 400;
                case 'uncommon':
                    return 200;
                default:
                    return 999999;
            }
        case 'music':
            switch (rarity) {
                case 'legendary':
                case 'epic':
                    return 500;
                case 'rare':
                case 'uncommon':
                    return 200;
                default:
                    return 999999;
            }
        default:
            return 999999;
    }
}

function updatecfgomg(dailyItems, featuredItems) {
    const catalogConfig = { "//": "BR Item Shop Config" };

    dailyItems.forEach((item, index) => {
        catalogConfig[`daily${index + 1}`] = {
            itemGrants: formatitemgrantsyk(item),
            price: notproperpricegen(item)
        };
    });

    featuredItems.forEach((item, index) => {
        catalogConfig[`featured${index + 1}`] = {
            itemGrants: formatitemgrantsyk(item),
            price: notproperpricegen(item)
        };
    });

    fs.writeFileSync(catalogcfg, JSON.stringify(catalogConfig, null, 2), 'utf-8');
    log.AutoRotation("The item shop has rotated!");
}


const { Readable } = require('stream');
const { createCanvas, loadImage } = require('canvas'); // Canvas package for drawing images

async function discordpost(itemShop) {
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }

    async function fetchItemIcon(itemName) {
        try {
            const response = await axios.get(`https://fortnite-api.com/v2/cosmetics/br/search?name=${encodeURIComponent(itemName)}`);
            if (response.data?.data?.images?.smallIcon) {
                return response.data.data.images.smallIcon;
            } else {
                log.error(`No small icon found for ${itemName}`);
                return 'https://via.placeholder.com/200'; // Larger placeholder if no icon found
            }
        } catch (error) {
            log.error(`Error fetching icon for ${itemName}: ${error.message || error}`);
            return 'https://via.placeholder.com/200'; // Larger placeholder if API fails
        }
    }

    async function generateItemShopImage(dailyItems, featuredItems) {
    const canvas = createCanvas(1920, 1080);
    const ctx = canvas.getContext('2d');

    // Load background image
    const backgroundImage = await loadImage('https://i.imgur.com/1vsFSyC.png');
    ctx.drawImage(backgroundImage, 0, 0, 1920, 1080);

    const centerX = 960; // Center of the image
    const itemWidth = 200;  // Increased icon size
    const itemSpacing = 280; // Increased spacing for better visibility

    // Function to draw section titles
function drawSectionTitle(title, yPosition) {
    ctx.save();

    ctx.font = 'bold 70px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';

    // Subtle white glow
    ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Solid white fill
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(title, centerX, yPosition);

    ctx.restore();
}

    // Function to draw items (image, name, price) with background
    async function drawItems(items, yOffset) {
        let xOffset = centerX - ((items.length * itemSpacing) / 2) + (itemSpacing / 2); // Adjust centering

        for (const item of items) {
            const itemIconUrl = await fetchItemIcon(item.name);
            const itemIcon = await loadImage(itemIconUrl);
            const itemPrice = notproperpricegen(item) || "Unknown Price";

            // Draw dark background behind the item (icon, name, price)
            const backgroundHeight = itemWidth + 150; // Height of the background for each item (icon + text)
            const backgroundY = yOffset - 20; // Position for the background

            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Dark semi-transparent background
            ctx.fillRect(xOffset - (itemWidth / 2) - 20, backgroundY, itemWidth + 40, backgroundHeight); // Add padding

            // Draw item icon
            ctx.drawImage(itemIcon, xOffset - (itemWidth / 2), yOffset, itemWidth, itemWidth);

            // Text properties
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';

            // Draw item name
            ctx.font = '30px Arial';
            ctx.fillText(item.name, xOffset, yOffset + itemWidth + 50);

            // Draw item price
            ctx.font = '26px Arial';
            ctx.fillText(`${itemPrice} V-Bucks`, xOffset, yOffset + itemWidth + 90);

            // Move to next item
            xOffset += itemSpacing;
        }
    }

    // Draw section titles and items
    drawSectionTitle('Featured', 150); // Featured section first
    await drawItems(featuredItems, 220); // Featured items

    drawSectionTitle('Daily', 615); // Daily section next
    await drawItems(dailyItems, 670); // Daily items

    return canvas.toBuffer('image/png');
}

async function saveItemShopImage(imageBuffer) {
    try {
        // Define the path where you want to save the image
        const savePath = path.join(__dirname, 'backend', 'itemshop.png');
        
        // Write the image buffer to the file system
        await fs.promises.writeFile(savePath, imageBuffer);
        console.log('Item shop image saved successfully at:', savePath);
    } catch (error) {
        console.error('Error saving image:', error.message);
    }
}



    async function sendToDiscord(imageBuffer) {
        try {
            const formData = new FormData();
            const readableStream = Readable.from(imageBuffer);

            formData.append('file', readableStream, { filename: 'item_shop.png', contentType: 'image/png' });

            // Discord embed structure
            const embed = {
                title: "New Eclipse Item Shop!",
                color: 0x00008B, // Dark blue color
                image: { url: "attachment://item_shop.png" },
                footer: { text: "Restart your game to see the new itemshop!" }
            };

            formData.append('payload_json', JSON.stringify({
                content: "<@&>", // Mentions the role
                allowed_mentions: { parse: ["roles"] }, // Ensures the mention works
                embeds: [embed]
            }));

            const response = await axios.post(config.bItemShopWebhook, formData, {
                headers: formData.getHeaders(),
            });

            log.AutoRotation('Item shop posted successfully to Discord:', response.status);
        } catch (error) {
            log.error('Error posting to Discord:', error.message);
        }
    }

    // Generate and send image
    const imageBuffer = await generateItemShopImage(itemShop.daily, itemShop.featured);
    await sendToDiscord(imageBuffer);
}

async function rotateshop() {
    try {
        const cosmetics = await fetchitems();
        if (cosmetics.length === 0) {
            log.error('No cosmetics found?');
            return;
        }

        const dailyItems = pickRandomItems(cosmetics, dailyItemsCount);

        // Filter only character items for featured
        const characterItems = cosmetics.filter(item => item.type?.value.toLowerCase() === "outfit");
        const featuredItems = pickRandomItems(characterItems, featuredItemsCount);

        updatecfgomg(dailyItems, featuredItems);
        await discordpost({ daily: dailyItems, featured: featuredItems });

        const nextRotationTime = milisecstillnextrotation();
        log.AutoRotation(`Scheduling next rotation in: ${nextRotationTime} milliseconds`);
        
        setTimeout(rotateshop, nextRotationTime);

    } catch (error) {
        log.error('Error while rotating:', error.message || error);
    }
}

function getUTCTimeFromLocal(hour, minute) {
    const now = new Date();
    const localTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
    return new Date(localTime.toUTCString());
}

function milisecstillnextrotation() {
    const now = new Date();
    const [localHour, localMinute] = config.bRotateTime.toString().split(':').map(Number);
    const nextRotation = getUTCTimeFromLocal(localHour, localMinute);

    if (now.getTime() >= nextRotation.getTime()) {
        nextRotation.setUTCDate(nextRotation.getUTCDate() + 1);
    }

    const millisUntilNextRotation = nextRotation.getTime() - now.getTime();
    log.AutoRotation(`Current time: ${now.toUTCString()}`);
    log.AutoRotation(`Next rotation time (UTC): ${nextRotation.toUTCString()}`);
    log.AutoRotation(`Milliseconds until next rotation: ${millisUntilNextRotation}`);

    return millisUntilNextRotation;
}

setTimeout(rotateshop, milisecstillnextrotation());
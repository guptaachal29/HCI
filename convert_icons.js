const sharp = require('sharp');
const fs = require('fs');

async function convertIcons() {
  const sizes = [16, 48, 128];
  
  for (const size of sizes) {
    await sharp(`images/icon${size}.svg`)
      .png()
      .toFile(`images/icon${size}.png`);
    console.log(`Converted icon${size}.svg to icon${size}.png`);
  }
}

convertIcons().catch(console.error); 
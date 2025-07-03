import sharp from 'sharp';
import fs from 'fs';
import pngToIco from 'png-to-ico';

async function convertFavicon() {
  try {
    // Read the SVG file
    const svgBuffer = fs.readFileSync('public/favicon.svg');
    
    // Convert SVG to PNG
    const pngBuffer = await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toBuffer();
    
    // Write PNG file
    fs.writeFileSync('public/favicon.png', pngBuffer);
    console.log('Favicon converted to PNG successfully!');

    // Convert PNG to ICO
    const icoBuffer = await pngToIco(pngBuffer);
    fs.writeFileSync('public/favicon.ico', icoBuffer);
    console.log('Favicon converted to ICO successfully!');
  } catch (error) {
    console.error('Error converting favicon:', error);
  }
}

convertFavicon(); 
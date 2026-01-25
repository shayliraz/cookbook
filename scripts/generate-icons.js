// Script to generate PWA icons
// Run with: node scripts/generate-icons.js
// Requires: npm install canvas

const fs = require('fs');
const path = require('path');

// If canvas is available, use it; otherwise create placeholder files
let createCanvas;
try {
  createCanvas = require('canvas').createCanvas;
} catch (e) {
  console.log('Canvas not installed. Creating placeholder icons...');
  createCanvas = null;
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function drawIcon(ctx, size) {
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#f97316');
  gradient.addColorStop(1, '#ec4899');

  // Rounded rectangle background
  const radius = size * 0.15;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Chef hat (simplified)
  ctx.fillStyle = 'white';
  const centerX = size / 2;
  const scale = size / 512;

  // Hat top
  ctx.beginPath();
  ctx.ellipse(centerX, 150 * scale, 100 * scale, 60 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hat body
  ctx.fillRect(centerX - 80 * scale, 140 * scale, 160 * scale, 120 * scale);

  // Hat brim
  ctx.beginPath();
  ctx.ellipse(centerX, 260 * scale, 90 * scale, 25 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Simple face
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(centerX - 40 * scale, 320 * scale, 12 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + 40 * scale, 320 * scale, 12 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 8 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(centerX, 340 * scale, 40 * scale, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
}

if (createCanvas) {
  sizes.forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    drawIcon(ctx, size);

    const buffer = canvas.toBuffer('image/png');
    const filePath = path.join(iconsDir, `icon-${size}x${size}.png`);
    fs.writeFileSync(filePath, buffer);
    console.log(`Created: ${filePath}`);
  });
  console.log('All icons generated successfully!');
} else {
  // Create placeholder files
  sizes.forEach(size => {
    const filePath = path.join(iconsDir, `icon-${size}x${size}.png`);
    // Create a simple 1x1 orange pixel as placeholder
    const placeholder = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x97, 0x31, 0x00,
      0x00, 0x02, 0xDC, 0x01, 0x4A, 0x56, 0x2E, 0x9B, 0x35, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    fs.writeFileSync(filePath, placeholder);
    console.log(`Created placeholder: ${filePath}`);
  });
  console.log('Placeholder icons created. Install canvas package and re-run for proper icons.');
}

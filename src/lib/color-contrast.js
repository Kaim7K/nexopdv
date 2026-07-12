const HEX_PATTERN = /^#([0-9a-f]{6})$/i;

export function normalizeHex(value, fallback = '#0f1b17') {
  const text = String(value || '').trim();
  if (HEX_PATTERN.test(text)) return text.toLowerCase();
  const short = text.match(/^#([0-9a-f]{3})$/i);
  if (short) return `#${[...short[1]].map(char => char + char).join('')}`.toLowerCase();
  return fallback;
}

export function hexToRgb(value) {
  const hex = normalizeHex(value).slice(1);
  return [0, 2, 4].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
}

function channelLuminance(channel) {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(value) {
  const [red, green, blue] = hexToRgb(value).map(channelLuminance);
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

export function contrastRatio(first, second) {
  const bright = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (bright + 0.05) / (dark + 0.05);
}

export function bestTextColor(background) {
  const whiteRatio = contrastRatio(background, '#ffffff');
  const darkRatio = contrastRatio(background, '#101828');
  return whiteRatio >= darkRatio ? '#ffffff' : '#101828';
}

export function mixHex(first, second, amount = 0.5) {
  const ratio = Math.min(1, Math.max(0, Number(amount) || 0));
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const mixed = a.map((channel, index) => Math.round(channel + ((b[index] - channel) * ratio)));
  return `#${mixed.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function hexToHsl(value) {
  const [red, green, blue] = hexToRgb(value).map(channel => channel / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const difference = max - min;
  if (!difference) return `0 0% ${Math.round(lightness * 100)}%`;
  const saturation = difference / (1 - Math.abs((2 * lightness) - 1));
  let hue = max === red
    ? ((green - blue) / difference) % 6
    : max === green
      ? ((blue - red) / difference) + 2
      : ((red - green) / difference) + 4;
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;
  return `${hue} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

export function deriveSidebarPalette(backgroundValue, accentValue) {
  const background = normalizeHex(backgroundValue, '#0f1b17');
  const accent = normalizeHex(accentValue, '#16a06a');
  const foreground = bestTextColor(background);
  const accentForeground = bestTextColor(accent);
  const foregroundContrast = contrastRatio(background, foreground);
  const accentContrast = contrastRatio(background, accent);
  const accentSurface = mixHex(background, foreground, foreground === '#ffffff' ? 0.08 : 0.1);
  const border = mixHex(background, foreground, foreground === '#ffffff' ? 0.14 : 0.18);

  return {
    background,
    foreground,
    accent,
    accentForeground,
    accentSurface,
    border,
    foregroundContrast,
    accentContrast,
    isReadable: foregroundContrast >= 4.5,
    isAccentDistinct: accentContrast >= 1.6,
  };
}

export function applySidebarPalette(root, palette) {
  if (!root || !palette) return;
  root.style.setProperty('--sidebar-background', hexToHsl(palette.background));
  root.style.setProperty('--sidebar-foreground', hexToHsl(palette.foreground));
  root.style.setProperty('--sidebar-primary', hexToHsl(palette.accent));
  root.style.setProperty('--sidebar-primary-foreground', hexToHsl(palette.accentForeground));
  root.style.setProperty('--sidebar-accent', hexToHsl(palette.accentSurface));
  root.style.setProperty('--sidebar-accent-foreground', hexToHsl(palette.foreground));
  root.style.setProperty('--sidebar-border', hexToHsl(palette.border));
  root.style.setProperty('--sidebar-ring', hexToHsl(palette.accent));
}

# Luan Rodrigues — Photography Portfolio

A minimalist photography portfolio built with pure HTML, CSS, and JavaScript. No frameworks, no dependencies.

## Features

- **Masonry gallery** — CSS columns layout that adapts to any number of photos without gaps
- **Lightbox viewer** — Click any photo to enter fullscreen mode with keyboard navigation (arrows, Esc) and swipe support on mobile
- **Photo counter** — Shows current position (e.g. "12 / 241") in lightbox mode
- **Multilingual** — Full content in Portuguese, English, and Spanish with language switcher in the nav
- **Mobile-first responsive** — 3 columns on desktop, 2 on tablet/mobile, glassmorphism nav with hamburger menu
- **Lazy loading** — Images load as you scroll with a smooth fade-in effect
- **Scroll reveal** — Subtle entrance animations on page sections
- **Optimized images** — All photos resized to 1600px width for fast loading

## Pages

| Page | Description |
|------|-------------|
| Home | Hero + curated photo selection |
| Series | Grid of photography categories (Portraits, Events, Personal, Pre-Wedding) |
| Series Detail | Full photo gallery per series (masonry layout) |
| About | Bio, background, and equipment |
| Contact | Email, Instagram, WhatsApp |

## Series

- **Pre-Wedding** — Pri & Michel (241 photos)
- **Portraits** — Coming soon
- **Events** — Coming soon
- **Personal** — Coming soon

## Tech Stack

- HTML5
- CSS3 (custom properties, CSS columns, clamp(), backdrop-filter)
- Vanilla JavaScript (IntersectionObserver, touch events)
- Google Fonts (Inter)

## Structure

```
├── index.html              # Home (PT)
├── series.html             # Series listing (PT)
├── series-prewedding.html  # Pre-Wedding gallery (PT)
├── about.html              # About (PT)
├── contact.html            # Contact (PT)
├── en/                     # English pages
├── es/                     # Spanish pages
├── css/style.css           # All styles
├── js/main.js              # All scripts
├── images/
│   ├── prewedding/         # 241 photos (1600px, ~85MB total)
│   └── about.png           # About page photo
└── generate-prewedding.sh  # Script to regenerate gallery from images folder
```

## Local Development

Just open `index.html` in a browser. No build step needed.

To regenerate the Pre-Wedding pages after adding/removing photos:

```bash
bash generate-prewedding.sh
```

## License

All photographs are copyrighted by Luan Rodrigues. Code is open source.

# Luan Rodrigues — Photography Portfolio

Minimalist photography portfolio. Pure HTML, CSS, and JavaScript. No frameworks.

**Live:** [luanrodrigues.photography](https://luanrodrigues.photography)

## Features

- **Draggable portfolio grid** — Explore all photos by dragging, arrow keys, or touch. Seamless infinite horizontal loop (the grid is rendered twice side-by-side and `translateX` wraps invisibly)
- **Lightbox viewer** — Click any photo for fullscreen with keyboard navigation (arrows, Esc) and swipe on mobile
- **Anonymous likes** — Camera icon in the lightbox bottom-right (sketch outline → filled when liked). Click triggers a white flash + photo shake + heart pulse, like snapping a picture. Counts sync globally via Supabase, `localStorage` prevents re-liking on the same browser
- **Masonry galleries** — CSS grid layout for series pages, adapts to any aspect ratio
- **Scroll-driven video** — About page video scrubs with scroll position (desktop, GSAP ScrollTrigger). A "Scroll" hint sits over the video and fades on first interaction
- **Multilingual** — Full content in Portuguese, English, and Spanish, including the like prompt ("Gostou?" / "Liked it?" / "¿Te gusta?")
- **Mobile-optimized** — Responsive layout, touch-friendly navigation, poster fallback for video
- **Lazy loading** — Images load on scroll with fade-in
- **Location beacon** — Floating nav for multi-location series (Lugares, Eventos)

## Pages

| Page | Description |
|------|-------------|
| Home | Editorial showcase — random photo per collection, 2-column offset layout |
| Portfolio | Draggable grid with all photos + lightbox |
| Series | Cards linking to Lugares, Autoral, Pre-Wedding |
| Lugares | 7 locations with floating location nav |
| Eventos | 3 event sections with location nav |
| Pre-Wedding | 14 photos |
| Autoral | 24 photos |
| About | Scroll-controlled video (desktop) / poster (mobile) + bio |
| Contact | Email, Instagram, WhatsApp |

## Tech Stack

- HTML5 + CSS3 (custom properties, grid, clamp, backdrop-filter)
- Vanilla JavaScript (IntersectionObserver, touch events, drag-to-pan)
- GSAP + ScrollTrigger (CDN, About page only)
- Google Fonts (Inter)
- **Supabase (Postgres + REST)** — backend for the likes feature. See [`supabase/README.md`](./supabase/README.md) for the schema-governance pattern (public vs private schemas, RLS-first, SECURITY DEFINER writes)

## Structure

```
├── index.html              # Home (PT)
├── trabalho.html           # Portfolio — draggable grid (PT)
├── series.html             # Series listing (PT)
├── series-lugares.html     # Lugares — 7 locations (PT)
├── series-eventos.html     # Eventos (PT)
├── series-prewedding.html  # Pre-Wedding (PT)
├── series-autoral.html     # Autoral (PT)
├── about.html              # About (PT)
├── contact.html            # Contact (PT)
├── en/                     # English pages
├── es/                     # Spanish pages
├── css/style.css           # All styles
├── js/main.js              # Core JS (nav, lightbox, GSAP, masonry, dynamic likes loader)
├── js/allwork.js           # Portfolio grid (drag, arrows, infinite loop, lightbox)
├── js/likes.js             # Likes module (Supabase REST, flash/shake animations)
├── images/
│   ├── lugares/            # Location photos by city
│   ├── prewedding/         # Pre-Wedding photos
│   ├── autoral/            # Personal/autoral photos
│   ├── eventos/            # Event photos
│   ├── about-video.mp4     # Scroll-driven video
│   └── about-poster.jpg    # Mobile fallback
├── supabase/
│   ├── README.md           # Schema/governance conventions
│   └── migrations/         # Numbered SQL migrations (apply in order)
└── CNAME                   # Custom domain config
```

## Local Development

Open `index.html` in a browser. No build step needed.

For mobile testing on the same Wi-Fi:
```bash
python3 -m http.server 8000
# Access from phone: http://<your-local-ip>:8000
```

## Hosting

GitHub Pages with automatic deploy on push (~40s). Custom domain via Cloudflare DNS.

## License

All photographs are copyrighted by Luan Rodrigues. Code is open source.

#!/bin/bash
# Generates the pre-wedding gallery HTML from all images in images/prewedding/
# Usage: cd /tmp/portfolio-luan && bash generate-prewedding.sh

DIR="images/prewedding"
PHOTOS=$(ls "$DIR"/*.jpg 2>/dev/null | sort)
COUNT=$(echo "$PHOTOS" | wc -l | tr -d ' ')

echo "Found $COUNT photos in $DIR"

# Generate gallery items
GALLERY_ITEMS=""
for photo in $PHOTOS; do
  fname=$(basename "$photo")
  GALLERY_ITEMS+="      <div class=\"gallery-item\"><img src=\"$DIR/$fname\" alt=\"Pre-Wedding Pri e Michel\" loading=\"lazy\"></div>
"
done

# --- PT ---
cat > series-prewedding.html << 'HEADER'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pre-Wedding — Luan Rodrigues</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>

  <nav>
    <a href="index.html" class="nav-logo">Luan Rodrigues</a>
    <button class="nav-toggle" aria-label="Menu" aria-expanded="false">
      <span></span><span></span>
    </button>
    <ul class="nav-links">
      <li><a href="index.html">Trabalho</a></li>
      <li><a href="series.html">Series</a></li>
      <li><a href="about.html">Sobre</a></li>
      <li><a href="contact.html">Contato</a></li>
    </ul>
    <div class="nav-lang">
      <a href="series-prewedding.html" class="active-lang">PT</a>
      <span>/</span>
      <a href="en/series-prewedding.html">EN</a>
      <span>/</span>
      <a href="es/series-prewedding.html">ES</a>
    </div>
  </nav>

  <section class="page-header">
    <div class="reveal">
      <h3><a href="series.html" style="opacity: 0.6;">Series</a> &rarr;</h3>
      <h1>Pre-Wedding</h1>
      <p class="series-subtitle">Pri & Michel</p>
    </div>
  </section>

  <section class="series-detail">
    <div class="series-detail-grid gallery-grid">
HEADER

echo "$GALLERY_ITEMS" >> series-prewedding.html

cat >> series-prewedding.html << 'FOOTER'
    </div>
  </section>

  <div id="lightbox" class="lightbox">
    <button class="lightbox-close" aria-label="Fechar">&times;</button>
    <button class="lightbox-nav lightbox-prev" aria-label="Anterior">&#8249;</button>
    <img src="" alt="">
    <button class="lightbox-nav lightbox-next" aria-label="Proxima">&#8250;</button>
  </div>

  <footer><p>&copy; 2026 Luan Rodrigues</p></footer>
  <script src="js/main.js"></script>
</body>
</html>
FOOTER

# --- EN ---
GALLERY_EN=""
for photo in $PHOTOS; do
  fname=$(basename "$photo")
  GALLERY_EN+="      <div class=\"gallery-item\"><img src=\"../$DIR/$fname\" alt=\"Pre-Wedding Pri and Michel\" loading=\"lazy\"></div>
"
done

cat > en/series-prewedding.html << 'HEADER'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pre-Wedding — Luan Rodrigues</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>

  <nav>
    <a href="index.html" class="nav-logo">Luan Rodrigues</a>
    <button class="nav-toggle" aria-label="Menu" aria-expanded="false">
      <span></span><span></span>
    </button>
    <ul class="nav-links">
      <li><a href="index.html">Work</a></li>
      <li><a href="series.html">Series</a></li>
      <li><a href="about.html">About</a></li>
      <li><a href="contact.html">Contact</a></li>
    </ul>
    <div class="nav-lang">
      <a href="../series-prewedding.html">PT</a>
      <span>/</span>
      <a href="series-prewedding.html" class="active-lang">EN</a>
      <span>/</span>
      <a href="../es/series-prewedding.html">ES</a>
    </div>
  </nav>

  <section class="page-header">
    <div class="reveal">
      <h3><a href="series.html" style="opacity: 0.6;">Series</a> &rarr;</h3>
      <h1>Pre-Wedding</h1>
      <p class="series-subtitle">Pri & Michel</p>
    </div>
  </section>

  <section class="series-detail">
    <div class="series-detail-grid gallery-grid">
HEADER

echo "$GALLERY_EN" >> en/series-prewedding.html

cat >> en/series-prewedding.html << 'FOOTER'
    </div>
  </section>

  <div id="lightbox" class="lightbox">
    <button class="lightbox-close" aria-label="Close">&times;</button>
    <button class="lightbox-nav lightbox-prev" aria-label="Previous">&#8249;</button>
    <img src="" alt="">
    <button class="lightbox-nav lightbox-next" aria-label="Next">&#8250;</button>
  </div>

  <footer><p>&copy; 2026 Luan Rodrigues</p></footer>
  <script src="../js/main.js"></script>
</body>
</html>
FOOTER

# --- ES ---
GALLERY_ES=""
for photo in $PHOTOS; do
  fname=$(basename "$photo")
  GALLERY_ES+="      <div class=\"gallery-item\"><img src=\"../$DIR/$fname\" alt=\"Pre-Wedding Pri y Michel\" loading=\"lazy\"></div>
"
done

cat > es/series-prewedding.html << 'HEADER'
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pre-Wedding — Luan Rodrigues</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>

  <nav>
    <a href="index.html" class="nav-logo">Luan Rodrigues</a>
    <button class="nav-toggle" aria-label="Menu" aria-expanded="false">
      <span></span><span></span>
    </button>
    <ul class="nav-links">
      <li><a href="index.html">Trabajo</a></li>
      <li><a href="series.html">Series</a></li>
      <li><a href="about.html">Acerca</a></li>
      <li><a href="contact.html">Contacto</a></li>
    </ul>
    <div class="nav-lang">
      <a href="../series-prewedding.html">PT</a>
      <span>/</span>
      <a href="../en/series-prewedding.html">EN</a>
      <span>/</span>
      <a href="series-prewedding.html" class="active-lang">ES</a>
    </div>
  </nav>

  <section class="page-header">
    <div class="reveal">
      <h3><a href="series.html" style="opacity: 0.6;">Series</a> &rarr;</h3>
      <h1>Pre-Wedding</h1>
      <p class="series-subtitle">Pri & Michel</p>
    </div>
  </section>

  <section class="series-detail">
    <div class="series-detail-grid gallery-grid">
HEADER

echo "$GALLERY_ES" >> es/series-prewedding.html

cat >> es/series-prewedding.html << 'FOOTER'
    </div>
  </section>

  <div id="lightbox" class="lightbox">
    <button class="lightbox-close" aria-label="Cerrar">&times;</button>
    <button class="lightbox-nav lightbox-prev" aria-label="Anterior">&#8249;</button>
    <img src="" alt="">
    <button class="lightbox-nav lightbox-next" aria-label="Siguiente">&#8250;</button>
  </div>

  <footer><p>&copy; 2026 Luan Rodrigues</p></footer>
  <script src="../js/main.js"></script>
</body>
</html>
FOOTER

echo "Done! Generated pages with $COUNT photos for PT, EN, ES"

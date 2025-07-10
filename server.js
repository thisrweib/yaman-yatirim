const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statik dosyalar ve uploads klasörü
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Veritabanı bağlantısı
const db = new sqlite3.Database('./contact.db', (err) => {
  if (err) {
    console.error('Veritabanı bağlantı hatası:', err.message);
  } else {
    console.log('SQLite veritabanına bağlanıldı.');
  }
});

// Tablo oluştur
db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    subject TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT,
    category TEXT,
    price TEXT,
    description TEXT,
    location TEXT,
    image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Multer storage ayarı (dosya ismi özgün ve benzersiz)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Mesaj gönderme endpoint
app.post('/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
  }

  const query = `INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)`;
  db.run(query, [name, email, subject, message], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Veritabanı hatası' });
    }
    res.status(200).json({ message: 'Mesaj başarıyla kaydedildi', id: this.lastID });
  });
});

// Mesajları listeleme endpoint
app.get('/messages', (req, res) => {
  const query = `SELECT * FROM messages ORDER BY created_at DESC`;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Veritabanı hatası' });
    }
    res.json(rows);
  });
});

// Yeni ilan ekleme (fotoğraflı)
app.post('/add-property', upload.single('image'), (req, res) => {
  const { status, category, price, description, location } = req.body;
  if (!status || !category || !price || !description || !location || !req.file) {
    return res.status(400).send("Tüm alanlar zorunludur ve fotoğraf yüklenmelidir.");
  }

  const image = req.file.filename; // sadece dosya adı kaydedilecek

  const query = `INSERT INTO properties (status, category, price, description, location, image) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(query, [status, category, price, description, location, image], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Kayıt sırasında hata oluştu.");
    }
  });

  res.redirect('/admin.html');
});

// İlanları listeleme (API)
app.get('/api/properties', (req, res) => {
  const sql = `SELECT * FROM properties ORDER BY created_at DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const properties = rows.map(p => ({
      id: p.id,
      status: p.status,
      type: p.category,
      price: p.price,
      description: p.description,
      address: p.location,
      image: `/uploads/${p.image}`, // frontend için relative path
      title: p.description.substring(0, 20) + "...",
      area: 0,
      bedrooms: 0,
      bathrooms: 0
    }));

    res.json(properties);
  });
});

// İlan silme endpoint (JSON yanıt döndür)
app.delete('/delete-property/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM properties WHERE id = ?', [id], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: "Silme sırasında hata oluştu." });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "İlan bulunamadı." });
    }
    res.json({ message: "İlan başarıyla silindi." });
  });
});

// Server başlatma
app.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} üzerinde çalışıyor`);
});

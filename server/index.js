const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { Client } = require('ssh2');
const FtpClient = require('ftp');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const cron = require('node-cron');
const cheerio = require('cheerio');

const app = express();
const port = 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new sqlite3.Database('ftp_manager.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to database successfully');
  }
});

db.serialize(() => {
  // Create products table
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER,
    name TEXT NOT NULL,
    price REAL,
    promotion TEXT,
    availability TEXT,
    retrieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating products table:', err);
    } else {
      console.log('Products table ready');
    }
  });

  // Create suppliers table
  db.run(`CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    username TEXT,
    password TEXT,
    schedule_type TEXT NOT NULL DEFAULT 'daily',
    schedule_day INTEGER,
    schedule_hour INTEGER NOT NULL DEFAULT 0,
    product_selector TEXT,
    name_selector TEXT,
    price_selector TEXT,
    promotion_selector TEXT,
    availability_selector TEXT
  )`, (err) => {
    if (err) {
      console.error('Error creating suppliers table:', err);
    } else {
      console.log('Suppliers table ready');
    }
  });

  // Create file_history table
  db.run(`CREATE TABLE IF NOT EXISTS file_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER,
    filename TEXT NOT NULL,
    retrieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating file_history table:', err);
    } else {
      console.log('File history table ready');
    }
  });
});

// Helper function to scrape HTML content
async function scrapeProducts(supplier) {
  try {
    const response = await axios.get(supplier.url);
    const $ = cheerio.load(response.data);
    const products = [];

    $(supplier.product_selector).each((i, elem) => {
      const name = supplier.name_selector ? $(elem).find(supplier.name_selector).text().trim() : '';
      const priceText = supplier.price_selector ? $(elem).find(supplier.price_selector).text().trim() : '';
      const price = parseFloat(priceText.replace(/[^0-9.,]/g, '').replace(',', '.')) || null;
      const promotion = supplier.promotion_selector ? $(elem).find(supplier.promotion_selector).text().trim() : '';
      const availability = supplier.availability_selector ? $(elem).find(supplier.availability_selector).text().trim() : '';

      products.push({
        name,
        price,
        promotion,
        availability
      });
    });

    // Save products to database
    const stmt = db.prepare(`
      INSERT INTO products (supplier_id, name, price, promotion, availability)
      VALUES (?, ?, ?, ?, ?)
    `);

    products.forEach(product => {
      stmt.run(
        supplier.id,
        product.name,
        product.price,
        product.promotion,
        product.availability
      );
    });

    stmt.finalize();

    return products;
  } catch (error) {
    console.error('Error scraping products:', error);
    throw error;
  }
}

// API Endpoints
app.post('/api/suppliers', (req, res) => {
  const { 
    name, 
    type, 
    url, 
    username, 
    password, 
    schedule_type,
    schedule_day,
    schedule_hour,
    product_selector,
    name_selector,
    price_selector,
    promotion_selector,
    availability_selector
  } = req.body;

  console.log('Adding new supplier:', { name, type, url });
  
  try {
    new URL(url);
  } catch (err) {
    console.error('Invalid URL format:', url);
    res.status(400).json({ error: 'Invalid URL format' });
    return;
  }
  
  db.run(
    `INSERT INTO suppliers (
      name, type, url, username, password, 
      schedule_type, schedule_day, schedule_hour,
      product_selector, name_selector, price_selector,
      promotion_selector, availability_selector
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name, type, url, username, password, 
      schedule_type, schedule_day, schedule_hour,
      product_selector, name_selector, price_selector,
      promotion_selector, availability_selector
    ],
    function(err) {
      if (err) {
        console.error('Error adding supplier:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      console.log('Supplier added successfully, ID:', this.lastID);
      res.json({ id: this.lastID });
    }
  );
});

app.get('/api/suppliers', (req, res) => {
  console.log('Fetching all suppliers');
  db.all('SELECT * FROM suppliers', [], (err, rows) => {
    if (err) {
      console.error('Error fetching suppliers:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    console.log('Found suppliers:', rows.length);
    res.json(rows);
  });
});

// New endpoint to get products for a supplier
app.get('/api/suppliers/:id/products', (req, res) => {
  const { id } = req.params;
  
  db.all(
    `SELECT * FROM products 
     WHERE supplier_id = ? 
     ORDER BY retrieved_at DESC`,
    [id],
    (err, rows) => {
      if (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Modified download endpoint to handle HTML scraping
app.post('/api/suppliers/:id/download', async (req, res) => {
  const { id } = req.params;

  try {
    const supplier = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM suppliers WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else if (!row) reject(new Error('Supplier not found'));
        else resolve(row);
      });
    });

    if (supplier.type === 'HTTP') {
      const products = await scrapeProducts(supplier);
      res.json(products);
    } else {
      // Handle FTP/SFTP downloads as before
      res.status(400).json({ error: 'Not implemented for this supplier type' });
    }
  } catch (error) {
    console.error('Error processing download:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

require('dotenv').config();
const db = require('./config/db');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
console.log("Express aplikacija je pokrenuta...");

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:4200').split(',').map(origin => origin.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(bodyParser.json());

const loginAttempts = new Map();
const loginRateLimit = (req, res, next) => {
    const key = `${req.ip}:${String(req.body?.email || '').toLowerCase()}`;
    const now = Date.now();
    const recent = (loginAttempts.get(key) || []).filter(time => now - time < 15 * 60 * 1000);
    if (recent.length >= 10) return res.status(429).json({ message: 'Previše pokušaja prijave. Pokušajte ponovo za 15 minuta.' });
    recent.push(now); loginAttempts.set(key, recent); next();
};
const getCookie = (req, name) => {
    const item = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
    return item ? decodeURIComponent(item.substring(name.length + 1)) : null;
};

app.use('/api/auth/login', loginRateLimit);
app.use('/api/auth', authRoutes);

const authenticateUser = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1] || getCookie(req, 'bnb_token');

    if (!token) {
        console.error('Nema tokena u zahtevu!');
        return res.status(401).json({ message: "Nema tokena, neautorizovan pristup" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Dekodirani JWT token:', decoded);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Greška pri dekodiranju tokena:', error);
        return res.status(401).json({ message: "Nevažeći token" });
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Samo administrator ima pristup.' });
    next();
};

// Adds the role column automatically for databases created before the admin panel.
db.query("ALTER TABLE users ADD COLUMN role ENUM('user','admin') NOT NULL DEFAULT 'user'", err => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') console.error('Greška pri admin koloni:', err);
});
db.query("ALTER TABLE reservations ADD COLUMN termin VARCHAR(10) NOT NULL DEFAULT '20:00'", err => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') console.error('Greška pri terminu rezervacije:', err);
});
db.query("ALTER TABLE reservations ADD COLUMN sedista VARCHAR(100) NULL", err => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') console.error('Greška pri sedištima rezervacije:', err);
});
db.query("ALTER TABLE reservations ADD COLUMN kod VARCHAR(40) NULL", err => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') console.error('Greška pri kodu rezervacije:', err);
});
db.query(`CREATE TABLE IF NOT EXISTS reservation_seats (
    id INT AUTO_INCREMENT PRIMARY KEY, film_title VARCHAR(255) NOT NULL,
    datum DATE NOT NULL, termin VARCHAR(10) NOT NULL, sediste VARCHAR(5) NOT NULL,
    reservation_id INT NULL, UNIQUE KEY unique_show_seat (film_title, datum, termin, sediste)
)`, err => { if (err) console.error('Greška pri tabeli sedišta:', err); });

app.get('/api/seats', (req, res) => {
    const { film, datum, termin } = req.query;
    if (!film || !datum || !termin) return res.json([]);
    db.query('SELECT sediste FROM reservation_seats WHERE film_title = ? AND datum = ? AND termin = ?', [film, datum, termin], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Greška pri učitavanju sedišta.' });
        res.json(rows.map(row => row.sediste));
    });
});

// Bioskop održava sale i termine u bazi, umesto da termini budu fiksni u interfejsu.
db.query(`CREATE TABLE IF NOT EXISTS cinema_halls (
    id INT AUTO_INCREMENT PRIMARY KEY, naziv VARCHAR(80) NOT NULL UNIQUE,
    redovi INT NOT NULL DEFAULT 5, sedista_po_redu INT NOT NULL DEFAULT 8,
    aktivna TINYINT(1) NOT NULL DEFAULT 1
)`);
db.query(`CREATE TABLE IF NOT EXISTS screenings (
    id INT AUTO_INCREMENT PRIMARY KEY, film_title VARCHAR(255) NOT NULL, hall_id INT NOT NULL,
    datum DATE NOT NULL, termin VARCHAR(10) NOT NULL, cena DECIMAL(10,2) NOT NULL DEFAULT 6.50,
    UNIQUE KEY unique_screening (film_title, hall_id, datum, termin),
    CONSTRAINT screenings_hall_fk FOREIGN KEY (hall_id) REFERENCES cinema_halls(id) ON DELETE RESTRICT
)`);
db.query("INSERT IGNORE INTO cinema_halls (id, naziv, redovi, sedista_po_redu) VALUES (1, 'Sala 1', 5, 8)");

app.get('/api/screenings', (req, res) => {
    const params = []; let query = `SELECT s.id, s.film_title, s.datum, s.termin, s.cena, h.id AS hall_id, h.naziv AS sala, h.redovi, h.sedista_po_redu FROM screenings s JOIN cinema_halls h ON h.id=s.hall_id WHERE h.aktivna=1`;
    if (req.query.film) { query += ' AND s.film_title = ?'; params.push(req.query.film); }
    db.query(query + ' ORDER BY s.datum, s.termin', params, (err, rows) => err ? res.status(500).json({ message: 'Greška pri učitavanju projekcija.' }) : res.json(rows));
});

app.get('/api/admin/stats', authenticateUser, requireAdmin, (req, res) => {
    const queries = ['SELECT COUNT(*) AS total FROM users', 'SELECT COUNT(*) AS total FROM reservations', 'SELECT COUNT(*) AS total FROM reviews'];
    Promise.all(queries.map(q => new Promise((resolve, reject) => db.query(q, (err, rows) => err ? reject(err) : resolve(rows[0].total)))))
        .then(([users, reservations, reviews]) => res.json({ users, reservations, reviews }))
        .catch(err => { console.error('Admin statistika:', err); res.status(500).json({ message: 'Greška pri učitavanju statistike.' }); });
});

app.get('/api/admin/users', authenticateUser, requireAdmin, (req, res) => {
    db.query('SELECT id, name, email, role FROM users ORDER BY id DESC', (err, rows) => err ? res.status(500).json({ message: 'Greška pri učitavanju korisnika.' }) : res.json(rows));
});

app.patch('/api/admin/users/:id/role', authenticateUser, requireAdmin, (req, res) => {
    const role = req.body?.role;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ message: 'Nevažeća uloga.' });
    db.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id], (err, result) => {
        if (err) return res.status(500).json({ message: 'Greška pri promeni uloge.' });
        if (!result.affectedRows) return res.status(404).json({ message: 'Korisnik nije pronađen.' });
        res.json({ message: 'Uloga je promenjena.' });
    });
});

app.get('/api/admin/reservations', authenticateUser, requireAdmin, (req, res) => {
    db.query('SELECT id, username, email, film_title, broj_karata, datum, created_at FROM reservations ORDER BY created_at DESC', (err, rows) => err ? res.status(500).json({ message: 'Greška pri učitavanju rezervacija.' }) : res.json(rows));
});

app.get('/api/admin/reviews', authenticateUser, requireAdmin, (req, res) => {
    db.query('SELECT id, filmId, username, email, rating, comment FROM reviews ORDER BY id DESC', (err, rows) => err ? res.status(500).json({ message: 'Greška pri učitavanju recenzija.' }) : res.json(rows));
});

app.delete('/api/admin/reviews/:id', authenticateUser, requireAdmin, (req, res) => {
    db.query('DELETE FROM reviews WHERE id = ?', [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ message: 'Greška pri brisanju recenzije.' });
        if (!result.affectedRows) return res.status(404).json({ message: 'Recenzija nije pronađena.' });
        res.json({ message: 'Recenzija je obrisana.' });
    });
});

app.get('/api/admin/halls', authenticateUser, requireAdmin, (req, res) => {
    db.query('SELECT * FROM cinema_halls ORDER BY naziv', (err, rows) => err ? res.status(500).json({ message: 'Greška pri učitavanju sala.' }) : res.json(rows));
});
app.post('/api/admin/halls', authenticateUser, requireAdmin, (req, res) => {
    const { naziv, redovi, sedista_po_redu } = req.body || {};
    if (!naziv || !Number.isInteger(+redovi) || !Number.isInteger(+sedista_po_redu) || +redovi < 1 || +sedista_po_redu < 1) return res.status(400).json({ message: 'Unesite ispravne podatke sale.' });
    db.query('INSERT INTO cinema_halls (naziv, redovi, sedista_po_redu) VALUES (?, ?, ?)', [naziv.trim(), redovi, sedista_po_redu], (err, result) => err ? res.status(400).json({ message: 'Sala sa tim nazivom već postoji.' }) : res.status(201).json({ id: result.insertId }));
});
app.delete('/api/admin/halls/:id', authenticateUser, requireAdmin, (req, res) => {
    db.query('DELETE FROM cinema_halls WHERE id = ?', [req.params.id], (err, result) => err ? res.status(400).json({ message: 'Sala ima povezane projekcije i ne može se obrisati.' }) : !result.affectedRows ? res.status(404).json({ message: 'Sala nije pronađena.' }) : res.json({ message: 'Sala je obrisana.' }));
});
app.get('/api/admin/screenings', authenticateUser, requireAdmin, (req, res) => {
    db.query('SELECT s.*, h.naziv AS sala FROM screenings s JOIN cinema_halls h ON h.id=s.hall_id ORDER BY s.datum DESC, s.termin DESC', (err, rows) => err ? res.status(500).json({ message: 'Greška pri učitavanju projekcija.' }) : res.json(rows));
});
app.post('/api/admin/screenings', authenticateUser, requireAdmin, (req, res) => {
    const { film_title, hall_id, datum, termin, cena } = req.body || {};
    if (!film_title || !hall_id || !datum || !termin || Number(cena) < 0) return res.status(400).json({ message: 'Unesite sve podatke projekcije.' });
    db.query('INSERT INTO screenings (film_title, hall_id, datum, termin, cena) VALUES (?, ?, ?, ?, ?)', [film_title.trim(), hall_id, datum, termin, cena], (err, result) => err ? res.status(400).json({ message: 'Ista projekcija već postoji ili sala nije pronađena.' }) : res.status(201).json({ id: result.insertId }));
});
app.delete('/api/admin/screenings/:id', authenticateUser, requireAdmin, (req, res) => {
    db.query('DELETE FROM screenings WHERE id = ?', [req.params.id], (err, result) => err ? res.status(500).json({ message: 'Greška pri brisanju projekcije.' }) : !result.affectedRows ? res.status(404).json({ message: 'Projekcija nije pronađena.' }) : res.json({ message: 'Projekcija je obrisana.' }));
});

app.get('/reviews', (req, res) => {
    const { filmId, email } = req.query;

    if (!filmId) {
        return res.status(400).send('filmId je obavezan');
    }

    let query = 'SELECT username, email, rating, comment FROM reviews WHERE filmId = ?';
    let queryParams = [filmId];


    if (email) {
        query += ' AND email = ?';
        queryParams.push(email);
    }

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Greška pri dohvatanju recenzija:', err);
            return res.status(500).json({ message: 'Greška pri dohvatanju recenzija.' });
        }

        res.json(results);
    });
});


app.post('/reviews', authenticateUser, (req, res) => {
    console.log('Podaci primljeni na backend:', req.body);

    const { filmId, rating, comment } = req.body;
    const { username, email } = req.user;

    if (!filmId || !rating || !comment || !username || !email) {
        console.error('Nedostaju podaci:', { filmId, username, rating, comment });
        return res.status(400).send('Sva polja su obavezna');
    }

    const query = 'INSERT INTO reviews (filmId, username, email, rating, comment) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [filmId, username, email, rating, comment], (err) => {
        if (err) {
            console.error('Greška pri dodavanju recenzije:', err, { filmId, username, email, rating, comment });
            return res.status(500).json(err);
        }
        res.status(201).json({ message: 'Recenzija sačuvana' });
    });
});

app.delete('/reviews', (req, res) => {
    const { filmId } = req.query;
    if (!filmId) return res.status(400).send('filmId je obavezan');

    db.query('DELETE FROM reviews WHERE filmId = ?', [filmId], (err, result) => {
        if (err) {
            console.error('Greška pri brisanju recenzija:', err);
            return res.status(500).json(err);
        }
        res.send('Recenzije obrisane');
    });
});

app.post('/api/rezervacije', authenticateUser, (req, res) => {
    console.log('Primljen zahtev za čuvanje rezervacija:', req.body);

    const { rezervacije } = req.body;
    const { username, email } = req.user;

    if (!rezervacije || !Array.isArray(rezervacije) || rezervacije.length === 0) {
        return res.status(400).json({ message: 'Nema rezervacija za čuvanje.' });
    }

    const query = `INSERT INTO reservations (username, email, film_title, broj_karata, datum, termin, sedista, kod) VALUES ?`;

    const values = rezervacije.map(rez => [
        username, 
        email, 
        rez.film.title, 
        rez.brojKarata, 
        rez.datum,
        rez.termin || '20:00',
        Array.isArray(rez.sedista) ? rez.sedista.join(', ') : (rez.sedista || ''),
        rez.kod || `BNB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    ]);

    db.query(query, [values], (err, result) => {
        if (err) {
            console.error('Greška pri čuvanju rezervacija:', err);
            return res.status(500).json({ message: 'Greška pri čuvanju rezervacija.' });
        }

        const seatRows = [];
        rezervacije.forEach((rez, index) => (Array.isArray(rez.sedista) ? rez.sedista : []).forEach(seat => seatRows.push([rez.film.title, rez.datum, rez.termin || '20:00', seat, result.insertId + index])));
        if (!seatRows.length) return res.status(201).json({ message: 'Rezervacije uspešno sačuvane!' });
        db.query('INSERT INTO reservation_seats (film_title, datum, termin, sediste, reservation_id) VALUES ?', [seatRows], seatError => {
            if (seatError) {
                if (seatError.code === 'ER_DUP_ENTRY') {
                    db.query('DELETE FROM reservations WHERE id = ?', [result.insertId]);
                    return res.status(409).json({ message: 'Neko sedište je upravo zauzeto. Osvežite mapu i izaberite druga sedišta.' });
                }
                return res.status(500).json({ message: 'Greška pri čuvanju sedišta.' });
            }
            console.log(`Uspešno sačuvane rezervacije za korisnika ${username} (${email})`);
            res.status(201).json({ message: 'Rezervacije uspešno sačuvane!' });
        });
    });
});

app.get('/api/rezervacije', authenticateUser, (req, res) => {
    const { email } = req.user;

    db.query('SELECT id, film_title, broj_karata, datum, termin, sedista, kod, created_at FROM reservations WHERE email = ? ORDER BY datum DESC, termin DESC', [email], (err, results) => {
        if (err) {
            console.error('Greška pri dohvatanju rezervacija:', err);
            return res.status(500).json({ message: 'Greška pri dohvatanju rezervacija.' });
        }

        if (results.length === 0) {
            return res.json([]);  
        }

        res.json(results);
    });
});


app.delete('/api/rezervacije/:id', authenticateUser, (req, res) => {
    const { id } = req.params;
    const { email } = req.user;

    db.query('DELETE FROM reservations WHERE id = ? AND email = ?', [id, email], (err, result) => {
        if (err) {
            console.error('Greška pri brisanju rezervacije:', err);
            return res.status(500).json({ message: 'Greška pri brisanju rezervacije.' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Rezervacija nije pronađena ili ne pripada korisniku.' });
        }

        console.log(`Rezervacija sa ID ${id} obrisana za korisnika ${email}`);
        res.json({ message: 'Rezervacija uspešno obrisana!' });
    });
});



app.put('/api/update-user', authenticateUser, async (req, res) => {
    const { email, username, password } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email je obavezan.' });
    }

    let queries = [];
    let queryParams = [];

    if (username) {
       
        queries.push('UPDATE users SET name = ? WHERE email = ?');
        queryParams.push(username, email);

        queries.push('UPDATE reviews SET username = ? WHERE email = ?');
        queryParams.push(username, email);

        queries.push('UPDATE reservations SET username = ? WHERE email = ?');
        queryParams.push(username, email);
    }

    if (password) {
        try {
            const hashedPassword = await bcrypt.hash(password, 10); 
            queries.push('UPDATE users SET password = ? WHERE email = ?');
            queryParams.push(hashedPassword, email);
        } catch (error) {
            console.error('Greška pri enkripciji šifre:', error);
            return res.status(500).json({ message: 'Greška pri enkripciji šifre.' });
        }
    }

    if (queries.length === 0) {
        return res.status(400).json({ message: 'Nema podataka za ažuriranje.' });
    }

    db.beginTransaction(err => {
        if (err) {
            console.error('Greška pri pokretanju transakcije:', err);
            return res.status(500).json({ message: 'Greška pri pokretanju transakcije.' });
        }

        let completedQueries = 0;
        queries.forEach((query, index) => {
            db.query(query, [queryParams[index * 2], queryParams[index * 2 + 1]], (err, result) => {
                if (err) {
                    return db.rollback(() => {
                        console.error('Greška pri ažuriranju podataka:', err);
                        res.status(500).json({ message: 'Greška pri ažuriranju podataka.' });
                    });
                }

                completedQueries++;
                if (completedQueries === queries.length) {
                    db.commit(err => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('Greška pri potvrdi transakcije:', err);
                                res.status(500).json({ message: 'Greška pri potvrdi transakcije.' });
                            });
                        }

                        console.log(`Uspešno ažurirani podaci za korisnika ${email}`);
                        res.json({ message: 'Podaci uspešno ažurirani!' });
                    });
                }
            });
        });
    });
});







app.use((err, req, res, next) => {
    console.error('Neočekivana greška:', err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({ message: process.env.NODE_ENV === 'production' ? 'Došlo je do greške na serveru.' : (err.message || 'Došlo je do greške na serveru.') });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server pokrenut na portu ${PORT}`));

const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.signup = async (req, res) => {
    console.log("Signup zahtev primljen:", req.body);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Ime, email i lozinka su obavezni' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Lozinka mora imati najmanje 6 karaktera' });
    }

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, result) => {
        if (err) {
            console.error('Greška pri proveri korisnika:', err);
            return res.status(500).json({ message: 'Greška pri povezivanju sa bazom' });
        }
        if (result.length > 0) {
            return res.status(400).json({ message: 'Email je već registrovan' });
        }

        let hashedPassword;
        try {
            hashedPassword = await bcrypt.hash(password, 10);
        } catch (hashError) {
            console.error('Greška pri enkripciji lozinke:', hashError);
            return res.status(500).json({ message: 'Greška pri registraciji' });
        }

        db.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', 
            [name, email, hashedPassword], 
            (err, result) => {
                if (err) return res.status(500).json({ message: 'Greška pri registraciji' });
                res.status(201).json({ message: 'Korisnik uspešno registrovan' });
            }
        );
    });
};

exports.login = (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, result) => {
        if (err) {
            console.error('Greška pri pretrazi korisnika:', err);
            return res.status(500).json({ message: 'Greška na serveru' });
        }

        if (result.length === 0) {
            return res.status(400).json({ message: 'Neispravan email ili lozinka' });
        }

        const user = result[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Neispravan email ili lozinka' });
        }

        if (!user.name) {
            console.error('Greška: Korisničko ime (name) nije pronađeno u bazi!');
            return res.status(500).json({ message: 'Greška: Korisničko ime nije pronađeno' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.name, role: user.role || 'user' }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );

        console.log('Korisnik uspešno prijavljen:', { id: user.id, email: user.email, username: user.name });
        res.cookie('bnb_token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 1000, path: '/' });
        res.json({ token });
    });
};

exports.logout = (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        console.warn('Pokušaj odjave bez tokena.');
        return res.status(400).json({ message: "Niste prijavljeni." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(`Korisnik ${decoded.username} (${decoded.email}) se odjavio.`);
    } catch (err) {
        console.warn('Nevažeći token pri odjavi.');
    }

    res.json({ message: "Uspešno ste se odjavili" });
};

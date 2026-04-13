const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Configuración de la ruta con soporte para Railway (Variable de Entorno)
const dbPathUrl = process.env.DATABASE_PATH || path.resolve(__dirname, 'data', 'iglesia.db');

// Asegurar que exista la carpeta base (especialmente 'data' en entorno local/servidor si no existe)
const dirPath = path.dirname(dbPathUrl);
if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
}

const db = new sqlite3.Database(dbPathUrl, (err) => {
    if (err) {
        console.error('Error al conectar con SQLite:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite.');
        db.run('PRAGMA foreign_keys = ON');
    }
});

function initDb() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS miembros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            apellido TEXT NOT NULL,
            creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS eventos_fijos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            dia_semana INTEGER NOT NULL, -- 0=Domingo, 1=Lunes...
            creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS asistencia (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            miembro_id INTEGER NOT NULL,
            evento_fijo_id INTEGER NOT NULL,
            fecha DATE NOT NULL, -- formato YYYY-MM-DD
            tipo_registro TEXT CHECK(tipo_registro IN ('aspa', 'firma')) NOT NULL,
            firma_base64 TEXT,
            registrado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (miembro_id) REFERENCES miembros(id),
            FOREIGN KEY (evento_fijo_id) REFERENCES eventos_fijos(id),
            UNIQUE(miembro_id, evento_fijo_id, fecha)
        )`);

        // Pre-popular eventos recurrentes si la tabla está vacía
        db.get("SELECT COUNT(*) AS count FROM eventos_fijos", (err, row) => {
            if (!err && row.count === 0) {
                const stmt = db.prepare("INSERT INTO eventos_fijos (nombre, dia_semana) VALUES (?, ?)");
                
                // Domingo = 0, Jueves = 4, Sábado = 6
                stmt.run('Escuela Dominical - 1er Servicio', 0);
                stmt.run('Escuela Dominical - 2do Servicio', 0);
                stmt.run('Santa Cena', 0);
                stmt.run('Ayuno', 4);
                stmt.run('Ayuno', 6);
                
                stmt.finalize();
                console.log('Eventos fijos por defecto creados.');
            }
        });
    });
}

initDb();

module.exports = db;

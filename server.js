const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- RUTAS DE API ---

// Miembros
app.get('/api/miembros', (req, res) => {
    db.all('SELECT * FROM miembros ORDER BY apellido ASC, nombre ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/miembros', (req, res) => {
    const { nombre, apellido } = req.body;
    if (!nombre || !apellido) return res.status(400).json({ error: 'Nombre y apellido requeridos' });

    db.run('INSERT INTO miembros (nombre, apellido) VALUES (?, ?)', [nombre, apellido], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, nombre, apellido });
    });
});

// Eventos Fijos (Recurrentes)
app.get('/api/eventos_fijos', (req, res) => {
    db.all('SELECT * FROM eventos_fijos ORDER BY dia_semana ASC, id ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Asistencia
app.get('/api/asistencia/:evento_fijo_id/:fecha', (req, res) => {
    const { evento_fijo_id, fecha } = req.params;
    const query = `
        SELECT m.id as miembro_id, m.nombre, m.apellido, a.tipo_registro, a.firma_base64
        FROM miembros m
        LEFT JOIN asistencia a ON m.id = a.miembro_id AND a.evento_fijo_id = ? AND a.fecha = ?
        ORDER BY m.apellido ASC, m.nombre ASC
    `;
    db.all(query, [evento_fijo_id, fecha], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/asistencia', (req, res) => {
    const { evento_fijo_id, fecha, registros } = req.body;
    // registros es un array: [{miembro_id, tipo_registro, firma_base64}, ...]

    if (!evento_fijo_id || !fecha || !Array.isArray(registros)) {
        return res.status(400).json({ error: 'Datos de evento_fijo_id, fecha o registros inválidos' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const stmt = db.prepare(`
            INSERT INTO asistencia (miembro_id, evento_fijo_id, fecha, tipo_registro, firma_base64)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(miembro_id, evento_fijo_id, fecha) DO UPDATE SET
            tipo_registro=excluded.tipo_registro, firma_base64=excluded.firma_base64
        `);

        registros.forEach(reg => {
            stmt.run(reg.miembro_id, evento_fijo_id, fecha, reg.tipo_registro, reg.firma_base64 || null);
        });

        stmt.finalize();

        db.run('COMMIT', (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Asistencia guardada correctamente' });
        });
    });
});

// Eliminar asistencia
app.delete('/api/asistencia/:evento_fijo_id/:fecha/:miembro_id', (req, res) => {
    const { evento_fijo_id, fecha, miembro_id } = req.params;
    db.run('DELETE FROM asistencia WHERE evento_fijo_id = ? AND fecha = ? AND miembro_id = ?', 
        [evento_fijo_id, fecha, miembro_id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, deleted: this.changes > 0 });
    });
});

// Reportes Consolidados (Por Semana)
app.get('/api/reportes/semana', (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query; // YYYY-MM-DD
    
    if(!fecha_inicio || !fecha_fin) {
        return res.status(400).json({ error: 'Requiere fecha_inicio y fecha_fin' });
    }

    // Buscamos todas las asistencias en ese rango de fecha y hacemos un join con miembros y eventos fijos
    const query = `
        SELECT a.fecha, a.tipo_registro, a.miembro_id, e.nombre as evento_nombre, e.id as evento_fijo_id
        FROM asistencia a
        JOIN eventos_fijos e ON a.evento_fijo_id = e.id
        WHERE a.fecha >= ? AND a.fecha <= ?
        ORDER BY a.fecha ASC, e.id ASC
    `;

    db.all(query, [fecha_inicio, fecha_fin], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Retornamos las asistencias planas, el frontend estructurará la matriz
        res.json(rows);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});

import { Router } from 'express';
import { DocumentService } from '../services/DocumentService';
import pool from '../config/db';

const router = Router();

// Create Document
router.post('/documents', async (req, res) => {
    try {
        const { title, createdBy, content } = req.body;
        if (!title || !createdBy || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const doc = await DocumentService.createDocument(title, createdBy, content);
        res.status(201).json(doc);
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Create Version
router.post('/documents/:id/versions', async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Missing content' });
        }
        const version = await DocumentService.createVersion(id, content);
        res.status(201).json(version);
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Get Latest (Cache-First)
router.get('/documents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await DocumentService.getLatest(id);
        if (!data) return res.status(404).json({ error: 'Not found' });
        res.json(data);
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Full-Text Search
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ error: 'Missing query param q' });
        }

        const query = `
            SELECT id, title, created_by, created_at
            FROM documents 
            WHERE to_tsvector('english', title) @@ plainto_tsquery('english', $1)
        `;

        const result = await pool.query(query, [q]);
        res.json(result.rows);
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

export default router;

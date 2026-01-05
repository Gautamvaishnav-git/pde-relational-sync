import pool from '../config/db';
import { Document, DocumentVersion } from '../types';
import { CacheService } from './CacheService';
import { diffQueue } from '../config/queue';

export class DocumentService {

    /**
     * Create a new document with an initial version.
     */
    static async createDocument(title: string, createdBy: string, content: string): Promise<Document> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Insert Document
            const docRes = await client.query(
                `INSERT INTO documents (title, created_by) VALUES ($1, $2) RETURNING *`,
                [title, createdBy]
            );
            const docId = docRes.rows[0].id;

            // 2. Insert Version 1
            const verRes = await client.query(
                `INSERT INTO versions (document_id, version_number, content) VALUES ($1, 1, $2) RETURNING *`,
                [docId, content]
            );
            const versionId = verRes.rows[0].id;
            const versionCreatedAt = verRes.rows[0].created_at;

            // 3. Update Document
            const finalDocRes = await client.query(
                `UPDATE documents SET current_version_id = $1 WHERE id = $2 RETURNING *`,
                [versionId, docId]
            );

            await client.query('COMMIT');

            // 4. Update Cache (Post-Commit)
            await CacheService.setLatestVersion(docId, {
                documentId: docId,
                title: title,
                version: 1,
                content: content,
                updatedAt: versionCreatedAt
            });

            return finalDocRes.rows[0];
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Create a new version for an existing document.
     */
    static async createVersion(documentId: string, content: string): Promise<DocumentVersion> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Lock Document First (The Authority)
            // This ensures we serialize all access to this document ID
            const docRes = await client.query(
                'SELECT id, title, current_version_id FROM documents WHERE id = $1 FOR UPDATE',
                [documentId]
            );

            if (docRes.rows.length === 0) {
                throw new Error('Document not found');
            }

            const doc = docRes.rows[0];
            const currentVersionId = doc.current_version_id;

            let currentVersionNum = 0;
            let prevVersionId = null;

            if (currentVersionId) {
                // 2. Fetch Version Details
                const verRes = await client.query(
                    'SELECT version_number FROM versions WHERE id = $1',
                    [currentVersionId]
                );
                if (verRes.rows.length > 0) {
                    currentVersionNum = verRes.rows[0].version_number;
                    prevVersionId = currentVersionId;
                }
            }

            const newVersionNum = currentVersionNum + 1;

            // 3. Insert new version
            const insertVerRes = await client.query(
                `INSERT INTO versions (document_id, version_number, content) VALUES ($1, $2, $3) RETURNING *`,
                [documentId, newVersionNum, content]
            );
            const newVersion = insertVerRes.rows[0];

            // 4. Update document pointer
            await client.query(
                `UPDATE documents SET current_version_id = $1 WHERE id = $2`,
                [newVersion.id, documentId]
            );

            await client.query('COMMIT');

            // 5. Update Cache (Post-Commit)
            await CacheService.setLatestVersion(documentId, {
                documentId: documentId,
                title: doc.title,
                version: newVersionNum,
                content: content,
                updatedAt: newVersion.created_at
            });

            // 6. Trigger Async Job (Diff)
            if (prevVersionId) {
                try {
                    await diffQueue.add('generate-diff', {
                        documentId,
                        oldVersionId: prevVersionId,
                        newVersionId: newVersion.id
                    });
                } catch (err) {
                    console.error('Failed to add diff job to queue', err);
                }
            }

            return newVersion;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Get Latest Document Version with Cache Look-aside
     */
    static async getLatest(documentId: string): Promise<any> {
        // 1. Try Cache
        const cached = await CacheService.getLatestVersion(documentId);
        if (cached) return cached;

        // 2. Fallback to DB
        const client = await pool.connect();
        try {
            const query = `
                SELECT d.id as "documentId", d.title, v.version_number as version, v.content, v.created_at as "updatedAt"
                FROM documents d
                JOIN versions v ON d.current_version_id = v.id
                WHERE d.id = $1
            `;
            const res = await client.query(query, [documentId]);
            if (res.rows.length === 0) return null;

            const data = res.rows[0];

            // 3. Populate Cache
            await CacheService.setLatestVersion(documentId, data);

            return data;
        } finally {
            client.release();
        }
    }
}

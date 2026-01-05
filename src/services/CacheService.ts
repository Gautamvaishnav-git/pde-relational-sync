import redis from '../config/redis';

export class CacheService {
    private static getKey(documentId: string): string {
        return `doc:latest:${documentId}`;
    }

    static async setLatestVersion(documentId: string, data: any): Promise<void> {
        try {
            const key = this.getKey(documentId);
            await redis.set(key, JSON.stringify(data));
        } catch (error) {
            console.error('Redis set failed', error);
        }
    }

    static async getLatestVersion(documentId: string): Promise<any | null> {
        try {
            const key = this.getKey(documentId);
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Redis get failed', error);
            return null;
        }
    }
}

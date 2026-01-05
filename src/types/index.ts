export interface Document {
    id: string;
    title: string;
    created_by: string;
    current_version_id: string; // UUID
    created_at: Date;
}

export interface DocumentVersion {
    id: string;
    document_id: string; // UUID
    version_number: number;
    content: string;
    created_at: Date;
}

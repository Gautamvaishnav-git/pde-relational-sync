# 📄 Relational-Sync — Document Versioning System (Plan)

## 1. Objective

Build a document versioning system where:

* **PostgreSQL** is the **source of truth** for documents, metadata, and version history
* **Redis** provides **fast access** to the *latest version* of a document
* **BullMQ** handles **post-commit async processing** (change log / diff generation)
* The system remains **consistent under concurrency**

---

## 2. High-Level Architecture

```
Client
  │
  ▼
API Layer
  │
  ▼
PostgreSQL (source of truth)
  │        ▲
  │        │ Row-level locking + transactions
  ▼        │
Redis (latest version cache)
  │
  ▼
BullMQ (async diff / change log)
```

**Design Principle:**

* PostgreSQL → correctness & history
* Redis → performance
* BullMQ → non-critical async work

---

## 3. Relational Data Model

### 3.1 Documents Table

Purpose: Store document identity and metadata.

```
documents
- id (PK)
- title
- created_by
- current_version_id (FK → versions.id)
- created_at
```

Notes:

* `current_version_id` always points to the latest version
* Metadata changes are infrequent

---

### 3.2 Versions Table

Purpose: Maintain immutable version history.

```
versions
- id (PK)
- document_id (FK → documents.id)
- version_number
- content
- created_at
```

Notes:

* Versions are **append-only**
* No updates or deletes
* Immutability simplifies concurrency handling

---

## 4. Write Flow (Create New Version)

This is the **most critical path** of the system.

### Step-by-Step Flow

1. **Start DB transaction**
2. **Lock the document row**

   ```sql
   SELECT * FROM documents
   WHERE id = $1
   FOR UPDATE;
   ```
3. **Determine next version number**
4. **Insert new row into `versions`**
5. **Update `documents.current_version_id`**
6. **Commit transaction**

📌 After commit, the database is in a fully consistent state.

---

## 5. Concurrency Control

### Problem

Multiple users attempt to create a new version of the same document simultaneously.

### Solution

* Use **PostgreSQL row-level locking (`FOR UPDATE`)**
* Ensures:

  * Version numbers do not collide
  * `current_version_id` remains correct
  * Only one writer per document at a time

PostgreSQL acts as the **single concurrency authority**.

---

## 6. Redis Cache Strategy (Latest Version)

### Cache Design

**Key**

```
doc:latest:{documentId}
```

**Value (JSON)**

```json
{
  "documentId": "...",
  "title": "...",
  "version": 7,
  "content": "...",
  "updatedAt": "..."
}
```

### Cache Rules (Critical)

* Redis stores **only the latest version**
* Redis is **updated or invalidated only after DB commit**
* Cache miss → fallback to PostgreSQL

---

## 7. Cache Consistency Guarantee

### Preferred Approach: Application-Level Transaction Boundary

Flow:

1. PostgreSQL transaction commits
2. Application updates Redis
3. If Redis update fails → safe fallback to DB

Why:

* Avoids dirty cache
* Simple and production-friendly
* PostgreSQL remains the source of truth

---

### Alternative (Mentioned, Optional)

* Database trigger + event/NOTIFY
* Application listens and updates Redis

Used only if strict DB-driven sync is required.

---

## 8. Async Processing with BullMQ (Diff / Change Log)

### Purpose

Generate a diff between:

* Previous version
* Newly created version

### Flow

1. After DB commit
2. Push BullMQ job:

   ```json
   {
     "documentId": "...",
     "oldVersionId": "...",
     "newVersionId": "..."
   }
   ```
3. Worker:

   * Fetches both versions
   * Generates diff
   * Stores or logs result

### Why Async?

* Keeps write latency low
* Failure does not affect correctness
* Retries are safe

---

## 9. Search & Filtering

### Requirement

Full-text search on document titles.

### Implementation

* Use PostgreSQL `tsvector`
* Create GIN index

```sql
CREATE INDEX documents_title_search_idx
ON documents
USING GIN (to_tsvector('english', title));
```

Query example:

```sql
WHERE to_tsvector('english', title)
@@ plainto_tsquery('english', 'search term');
```

Redis is **not** used for search.

---

## 10. Failure Handling

| Scenario             | Behavior                      |
| -------------------- | ----------------------------- |
| DB transaction fails | No Redis update               |
| Redis update fails   | Cache miss → DB fallback      |
| BullMQ worker fails  | Retry later                   |
| Concurrent writes    | Serialized via row-level lock |

---

## 11. Atomic Task Breakdown

### Phase 1 – Schema & Setup

* PostgreSQL schema creation
* Redis connection setup
* BullMQ setup

---

### Phase 2 – Core Write Logic

* Transactional document version creation
* Row-level locking
* Version number calculation

---

### Phase 3 – Cache Integration

* Redis get/set latest version
* Cache fallback logic
* Post-commit update handling

---

### Phase 4 – Async Processing

* BullMQ producer (post-commit)
* Worker for diff generation

---

### Phase 5 – Search

* TSVector + GIN index
* Search API endpoint

---

## 12. Summary

This system ensures:

* **Strong consistency** via PostgreSQL transactions
* **High-performance reads** via Redis
* **Safe concurrency** with row-level locking
* **Scalable async processing** with BullMQ

> PostgreSQL is the source of truth, Redis is a derived cache, and BullMQ handles post-commit side effects.
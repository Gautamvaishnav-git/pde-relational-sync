# Relational-Sync Instructions

This guide provides step-by-step instructions to set up, run, and verify the Document Versioning System.

## 📋 Prerequisites

Ensure you have the following installed on your machine:
*   **Node.js** (v18 or higher)
*   **npm** (Node Package Manager)
*   **Docker** & **Docker Compose** (for running PostgreSQL and Redis)

## ⚙️ Setup

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Start Infrastructure**
    This project uses Docker Compose to manage PostgreSQL and Redis instances.
    ```bash
    docker compose up -d
    ```
    *   **PostgreSQL** runs on port `5432`
    *   **Redis** runs on port `6379`

3.  **Environment Variables**
    The project expects a `.env` file in the root directory. A default one should already be present:
    ```env
    PG_HOST=localhost
    PG_PORT=5432
    PG_USER=postgres
    PG_PASSWORD=postgres
    PG_DATABASE=postgres
    REDIS_HOST=localhost
    REDIS_PORT=6379
    PORT=3000
    ```

## 🚀 Running the Application

### Development Mode
Runs the server using `ts-node` for hot-reloading (if configured) or direct TypeScript execution.
```bash
npm run dev
```

### Production Build
Compiles the TypeScript code to JavaScript in the `dist` folder and includes necessary assets (like `schema.sql`).
```bash
npm run build
npm start
```

## ✅ Verification

To verify that the system correctly handles concurrent version updates (PostgreSQL Row-Level Locking):

1.  Ensure the server is running (in a separate terminal).
2.  Run the verification script:
    ```bash
    npm run npm:verify
    ```

**Expected Output:**
The script sends 5 parallel update requests. You should see a success message indicating the final version is `6` (1 initial creation + 5 updates).
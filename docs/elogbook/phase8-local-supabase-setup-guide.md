# Veda Setu NAMASTE e-Logbook: Phase 8 Local Supabase Setup Guide

> **Document Status**: **DOCUMENTATION & ENVIRONMENT READINESS GUIDE**  
> **Safety Directive**: **Zero Live Database Operations Performed**  
> **Purpose**: Beginner-friendly, step-by-step instructions for setting up an isolated local Supabase test environment on Windows for future e-Logbook schema testing.  
> **Date**: September 19, 2026

---

## 1. Executive Readiness Summary

| Component | Status | Finding | Action Required |
| :--- | :---: | :--- | :--- |
| **Supabase CLI** |  **Installed** | `npx supabase --version` $\to$ `2.117.0` | Ready for use. |
| **Docker Desktop** | ⚠️ **Not Found** | `'docker' is not recognized` | Requires manual one-time installation on Windows. |
| **Local Ports (54321-54323)**|  **Available** | Ports `54321`, `54322`, `54323` are free | No port conflicts detected. |
| **Production DB Protection** |  **Hardened** | Production Supabase is strictly disconnected from local testing | Live data remains 100% untouched. |

---

## 2. Understanding Local Supabase & Docker

### What is Docker Desktop?
Docker Desktop is a desktop application that lets your computer run lightweight, self-contained virtual environments called **containers**.

### Why do we use it for Supabase?
Instead of creating tables directly on the live cloud Supabase project (which holds real user data), Supabase CLI uses Docker to run a complete, miniature Supabase stack **locally on your laptop**:
- **Local PostgreSQL Database** (Port `54322`)
- **Local Auth / GoTrue Service** (Port `54321`)
- **Local Storage Emulator**
- **Local Supabase Studio Dashboard** (Port `54323` in your browser)

### Key Benefit: Total Isolation
A local database is a **throwaway sandbox**. You can create tables, test RLS policies, seed fake test cases, and reset everything without any risk of affecting live Veda Setu users.

---

## 3. Step-by-Step Local Setup Guide (Windows)

> [!IMPORTANT]
> The steps below are **MANUAL INSTRUCTIONS FOR YOU TO PERFORM** when you are ready. The assistant has not executed any software installations or started any services.

---

### Step 1: Install Docker Desktop on Windows

1. **Download the Official Installer**:
   - Go to: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
   - Click **Download for Windows**.
2. **Run the Installer**:
   - Double-click `Docker Desktop Installer.exe`.
   - Ensure the **"Use WSL 2 instead of Hyper-V (recommended)"** checkbox is selected.
   - Follow the on-screen prompts and click **Close and restart** when prompted.
3. **Start Docker Desktop**:
   - Open the **Docker Desktop** app from the Windows Start menu.
   - Accept the service agreement and wait until the bottom-left status bar shows **"Engine running"** (green icon).

---

### Step 2: Verify Docker & Supabase CLI

Open a new PowerShell or Command Prompt terminal in your `VedaSetu` directory and run:

```bash
# 1. Verify Docker CLI is accessible:
docker --version
# Expected output: Docker version 24.x or 27.x

# 2. Verify Docker daemon is responding:
docker ps
# Expected output: CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS   PORTS   NAMES

# 3. Verify Supabase CLI:
npx supabase --version
# Expected output: 2.117.0
```

---

### Step 3: Initialize and Start Local Supabase (Future Manual Step)

When you are ready to start the isolated local container:

```bash
# 1. Initialize local Supabase configuration (if config.toml is not yet created):
npx supabase init

# 2. Start the local Supabase container stack:
npx supabase start
```

*Note: The first time you run `npx supabase start`, Docker will download the Supabase container images. This takes 2–3 minutes depending on your internet connection.*

---

### Step 4: Confirming the Database Target is Genuinely Local

Once `npx supabase start` finishes, it will print your local connection endpoints:

```
==================================================
        LOCAL SUPABASE INSTANCE CONFIGURED
==================================================
API URL:        http://127.0.0.1:54321
GraphQL URL:    http://127.0.0.1:54321/graphql/v1
DB URL:         postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL:     http://127.0.0.1:54323
Inbucket URL:   http://127.0.0.1:54324
anon key:       eyJhbGciOiJIUzI1NiIsInR5cCI6... (Local Mock Key)
service_role:   eyJhbGciOiJIUzI1NiIsInR5cCI6... (Local Mock Key)
==================================================
```

> [!TIP]
> **Safety Check**: Always ensure the DB URL points to `127.0.0.1` (localhost). Never apply test migrations to any URL ending in `.supabase.co`.

---

### Step 5: Applying Foundation & e-Logbook Proposals (Future Manual Step)

Once local Supabase is running, apply the migration files sequentially to the **local instance only**:

```bash
# Apply foundation schemas and the Phase 5 e-Logbook proposal:
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" `
  -f supabase/migrations/001_foundation.sql `
  -f supabase/migrations/20260910034914_skill_assessment.sql `
  -f supabase/migrations/20260910071151_seed_ayurveda_competencies.sql `
  -f supabase/migrations/20260910105828_faculty_core.sql `
  -f supabase/migrations/20260911005825_student_mentorship_requests.sql `
  -f supabase/migrations/drafts/20260919_phase5_elogbook_final_proposal.sql
```

---

### Step 6: Viewing Tables in Local Supabase Studio

Open your browser and navigate to:  
👉 **`http://127.0.0.1:54323`**

You will see the local Supabase Studio web dashboard where you can visually inspect:
- Table structures (`clinical_case_logs`, `clinical_case_competencies`, `clinical_case_attachments`)
- Active RLS policies
- Database triggers and functions

---

### Step 7: Stopping Local Supabase Safely

When you are done testing, stop the local container stack to free memory:

```bash
# Stop local Supabase services:
npx supabase stop
```

---

## 4. Pre-Testing Safety Checklist (For Future Phase 9)

Before any database execution is attempted in future testing phases, **every item** on this checklist must be verified:

- [ ] **Docker Desktop Running**: Docker daemon is active and `docker ps` returns successfully without errors.
- [ ] **Local Instance Isolated**: Verified that database connection string is `127.0.0.1:54322` and NOT connected to remote cloud Supabase.
- [ ] **Zero Production Secrets**: Production `.env.local` keys, production passwords, and remote service-role keys are NOT used.
- [ ] **Synthetic Test Personas**: Test cases and profiles use purely synthetic names (e.g. `student1@test.edu`, `CASE-2026-KC-01`).
- [ ] **Production Unchanged**: Confirm that production Supabase project remains 100% untouched throughout all tests.

---

*This guide is complete and ready for future reference.*

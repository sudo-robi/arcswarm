# Database Operations & Resilience Runbook

This document details the production operational practices for ArcSwarm's PostgreSQL database infrastructure.

---

## 1. Connection Pooling Strategy (PgBouncer)

In high-throughput agent environments, each agent process and tRPC server node creates multiple database connections. To prevent reaching PostgreSQL `max_connections` limits:

- **Connection Pooler:** PgBouncer in `transaction` pooling mode.
- **Port:** `6432` (or AWS RDS Proxy / Prisma `pgbouncer=true` parameter).
- **Prisma Integration:** Direct connection URL uses PgBouncer port with `?pgbouncer=true`.
- **Max Client Connections:** 5,000 clients pooled into 50 server connections.

```bash
# Example DATABASE_URL with PgBouncer
DATABASE_URL="postgresql://postgres:secret@rds-primary.internal:6432/arcswarm?schema=public&pgbouncer=true"
```

---

## 2. Read Replicas & Query Splitting

Read-heavy operations (e.g., dashboard query endpoints, transaction history, agent status checks) are routed to PostgreSQL read replicas to relieve load from the primary write instance.

- **Primary DB:** Handles writes, transfers, allocations, and event indexer state.
- **Read Replica DB:** Handles tRPC read queries (`getVaultState`, `getTransactions`, `getAgentStatuses`).
- **Replication Lag Monitoring:** Alert triggered if replication lag exceeds `10 seconds`.

---

## 3. Automated Backup & Point-In-Time Recovery (PITR)

### Automated Daily Snapshots
- **Frequency:** Daily at 03:00 UTC.
- **Retention:** 30 days retained in AWS S3 with KMS encryption.

### Write-Ahead Logging (WAL) & PITR
- **WAL Archiving:** Continuous WAL archiving to S3 every 5 minutes.
- **PITR Window:** Any second within the last 30 days can be selected for recovery.

### Manual On-Demand Backup Command
```bash
pg_dump -h rds-primary.internal -U postgres -F c -b -v -f "/backups/arcswarm_manual_$(date +%Y%m%d_%H%M%S).dump" arcswarm
```

---

## 4. Disaster Recovery & Restore Procedure

### Step 1: Provision Restored Database Instance
From AWS RDS CLI or AWS Console:
```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier arcswarm-db \
  --target-db-instance-identifier arcswarm-db-restored \
  --restore-time "2026-08-06T12:00:00.000Z" \
  --db-instance-class db.t4g.medium
```

### Step 2: Run Verification & Data Integrity Audits
```bash
# Test connection to restored instance
psql -h arcswarm-db-restored.internal -U postgres -d arcswarm -c "SELECT count(*) FROM \"Transaction\";"
```

### Step 3: Switch Application Traffic
Update the `DATABASE_URL` secret in AWS Secrets Manager / Kubernetes Secret and execute a rolling update:
```bash
kubectl rollout restart deployment/arcswarm-api -n production
```

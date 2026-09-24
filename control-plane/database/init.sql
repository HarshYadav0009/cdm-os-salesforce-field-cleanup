-- ==============================================================================
-- CDM-OS — Database Initialization Script
-- Runs automatically on first `docker compose up` via initdb mount.
-- ==============================================================================

-- Enable pgvector for future RAG/embeddings use
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM Types
-- ============================================================

CREATE TYPE tool_tier AS ENUM ('Tier-1', 'Tier-2', 'Tier-3');
CREATE TYPE proposal_status AS ENUM (
    'PROPOSED',
    'POLICY_APPROVED',
    'POLICY_DENIED',
    'PENDING_HUMAN_APPROVAL',
    'HUMAN_APPROVED',
    'HUMAN_REJECTED',
    'EXECUTING',
    'COMPLETED',
    'FAILED',
    'ROLLED_BACK'
);
CREATE TYPE agent_status AS ENUM ('IDLE', 'RUNNING', 'PAUSED', 'ERROR', 'TERMINATED');

-- ============================================================
-- Table: agents — Registered Agent definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS agents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id        VARCHAR(128) UNIQUE NOT NULL,
    name            VARCHAR(256) NOT NULL,
    version         VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    description     TEXT,
    owner           VARCHAR(256),
    model_primary   VARCHAR(128) NOT NULL DEFAULT 'anthropic/claude-3-5-sonnet-20241022',
    model_fallback  VARCHAR(128),
    status          agent_status NOT NULL DEFAULT 'IDLE',
    config_yaml     TEXT,            -- Raw YAML agent config for audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: tool_definitions — Registered tools and their tier
-- ============================================================
CREATE TABLE IF NOT EXISTS tool_definitions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_id         VARCHAR(128) UNIQUE NOT NULL,
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    tier            tool_tier NOT NULL DEFAULT 'Tier-1',
    mcp_server      VARCHAR(128),       -- Which MCP server hosts this tool
    schema_json     JSONB,              -- Input schema for validation
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: proposals — Agent action proposals (core CDM-OS entity)
-- ============================================================
CREATE TABLE IF NOT EXISTS proposals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id        VARCHAR(128) NOT NULL REFERENCES agents(agent_id),
    tool_id         VARCHAR(128) NOT NULL REFERENCES tool_definitions(tool_id),
    status          proposal_status NOT NULL DEFAULT 'PROPOSED',
    tier            tool_tier NOT NULL,
    input_payload   JSONB NOT NULL,         -- What the agent wants to execute
    policy_result   JSONB,                  -- Policy engine evaluation output
    human_decision  JSONB,                  -- Human approval/rejection details
    execution_result JSONB,                 -- Tool execution output
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at      TIMESTAMPTZ,
    executed_at     TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: audit_log — Immutable, HMAC-signed event log
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type      VARCHAR(64) NOT NULL,   -- e.g. PROPOSAL_CREATED, POLICY_CHECK, HUMAN_DECISION, TOOL_EXECUTED
    actor           VARCHAR(128) NOT NULL,   -- agent_id, user_email, or 'system'
    proposal_id     UUID REFERENCES proposals(id),
    payload         JSONB NOT NULL,
    hmac_signature  VARCHAR(128),           -- HMAC-SHA256 of payload for tamper detection
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: policy_rules — Loaded from YAML, cached in DB
-- ============================================================
CREATE TABLE IF NOT EXISTS policy_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id         VARCHAR(128) UNIQUE NOT NULL,
    policy_file     VARCHAR(256) NOT NULL,  -- Source YAML filename
    action          VARCHAR(128) NOT NULL,  -- Tool action this rule applies to
    tier            tool_tier,
    conditions      JSONB NOT NULL,         -- Parsed conditions
    enforcement     JSONB,                  -- What happens on violation
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    loaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes for query performance
-- ============================================================
CREATE INDEX idx_proposals_agent_id ON proposals(agent_id);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_created ON proposals(created_at DESC);
CREATE INDEX idx_audit_log_event ON audit_log(event_type);
CREATE INDEX idx_audit_log_proposal ON audit_log(proposal_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================================
-- Seed: Default tool definitions for Salesforce Field Cleanup
-- ============================================================
INSERT INTO tool_definitions (tool_id, name, description, tier, mcp_server) VALUES
    ('salesforce_describe_global',    'Describe Global Objects',     'List all SObjects in the Salesforce org',                          'Tier-1', 'salesforce-mcp'),
    ('salesforce_describe_object',    'Describe SObject',            'Get field-level metadata for a specific SObject',                  'Tier-1', 'salesforce-mcp'),
    ('salesforce_query_field_usage',  'Query Field Usage',           'Run SOQL to compute field population % over a time window',        'Tier-1', 'salesforce-mcp'),
    ('salesforce_scan_apex_references','Scan Apex References',       'Search Apex classes, triggers, flows for field API name references','Tier-1', 'salesforce-mcp'),
    ('salesforce_deprecate_field',    'Deprecate Field',             'Mark field as deprecated (update description + remove FLS)',        'Tier-2', 'salesforce-mcp'),
    ('salesforce_backup_field_def',   'Backup Field Definition',     'Export field metadata XML before modification',                    'Tier-2', 'salesforce-mcp'),
    ('salesforce_delete_field',       'Delete Custom Field',         'Permanently delete a custom field from the org',                   'Tier-3', 'salesforce-mcp')
ON CONFLICT (tool_id) DO NOTHING;

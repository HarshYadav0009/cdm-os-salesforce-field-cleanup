# Audit & Observability — Enterprise-Grade Tracing

> **Architecture Reference: Sections §32-34 — Audit, Observability, Cost Metering**

## Why This Folder Exists

This top-level audit folder stores audit event **schemas**, **exporters**, and **analysis tools**. It complements `control-plane/audit/` (which is the audit event writer) — this folder is focused on the **observability platform integration** and **reporting** side.

## Purpose

Layer 7 of the architecture — everything needed to answer:
- What did the agent do?
- Why did it do it?
- Was the outcome correct?
- How much did it cost?
- Is it drifting from expected behavior?

## Observability Architecture (Section §33)

Traditional engineering metrics **plus** AI-specific telemetry:

### Standard Metrics
```
CPU | Memory | Latency | Errors | Availability
```

### Agent-Specific Metrics
```
Token usage | Model latency | Tool calls | Retries
Human overrides | Policy denials | Escalations
Hallucination rate | Task success rate | Cost/task | Drift
```

## Cost Metering (Section §34)

Every model call is attributed:
```
Agent ID → Guardian → Skill → Model → Input tokens → Output tokens → AWS cost → Task ID
```

Enabling calculation of:
- Cost per task
- Cost per agent
- Cost per skill
- Cost per guardian
- Cost per business function

This is essential for measuring the **Agent Multiplier** (is the agent actually saving more than it costs?).

## What To Do Here

1. **`schemas/`** — Audit event JSON schemas (for validation and documentation)
2. **`exporters/`** — Export audit events to external platforms:
   - `datadog_exporter.py` — Push metrics to Datadog
   - `splunk_exporter.py` — Push logs to Splunk
   - `cloudwatch_exporter.py` — Push to CloudWatch
3. **`dashboards/`** — Grafana/Datadog dashboard definitions
4. **`reports/`** — Report generators (daily cost summary, weekly agent performance, monthly governance report)
5. **`drift_detector.py`** — Detect behavioral drift by comparing recent actions against historical baselines

## Key Design Decisions

- Observability is not optional — it's Layer 7 of the architecture
- Cost tracking enables data-driven decisions about which agents are worth running
- Drift detection catches silent behavior changes from model/prompt/knowledge updates
- Every metric should be attributable to a specific agent, task, and guardian

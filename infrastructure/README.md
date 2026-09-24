# Infrastructure — IaC, Networking, and Deployment

> **Architecture Reference: Sections §28 — Event-Driven Architecture, §35-36 — Security, Ephemeral Credentials, §48 — Disaster Recovery**

## Why This Folder Exists

CDM-OS needs infrastructure: databases, message queues, compute, networking, IAM policies. This folder contains the Infrastructure-as-Code (IaC) definitions that provision and manage all of it.

## Purpose

Define and manage:
- **AWS infrastructure** via Terraform/CloudFormation
- **Event bus** configuration (EventBridge, SQS, SNS)
- **Networking** — VPCs, security groups, agent isolation
- **IAM** — Role definitions for ephemeral agent credentials
- **Container orchestration** — ECS/EKS task definitions
- **Disaster recovery** — Backup and restoration procedures

## Event-Driven Architecture (Section §28)

CDM-OS should be event-driven, not synchronous:

```
Event Bus
   │
   ├── DeploymentStarted
   ├── IncidentDetected
   ├── CostThresholdExceeded
   ├── AgentActionRequested
   ├── AgentActionCompleted
   ├── PolicyDenied
   ├── HumanApprovalReceived
   └── AgentEscalated
```

Potential AWS components:
- EventBridge (event routing)
- SQS (message queuing)
- SNS (notifications)
- Step Functions (workflow orchestration)
- Lambda (event handlers)
- ECS/EKS (agent runtime containers)

## Disaster Recovery (Section §48)

Must be able to restore:
```
┌───────────────────────────┐
│ Agent Registry             │
├───────────────────────────┤
│ Agent Configurations       │
├───────────────────────────┤
│ Skills                     │
├───────────────────────────┤
│ Prompt Versions            │
├───────────────────────────┤
│ Precedents                 │
├───────────────────────────┤
│ Policies                   │
├───────────────────────────┤
│ Audit Logs                 │
└───────────────────────────┘
```

The critical question isn't "Can we restore the database?" — it's: **"Can we recreate the exact behavior of the agent workforce?"**

## What To Do Here

1. **`terraform/`** — Terraform modules for AWS infrastructure
2. **`iam/`** — IAM role definitions for agents (ephemeral role templates)
3. **`networking/`** — VPC, security groups, network isolation
4. **`event-bus/`** — EventBridge rules, SQS queues, SNS topics
5. **`containers/`** — Dockerfile and ECS/EKS task definitions for each service
6. **`backup/`** — Backup schedules and restoration runbooks
7. **`environments/`** — Per-environment config (dev, qa, staging, production)

## Key Design Decisions

- **Event-driven** gives you scalability and auditability
- Agent runtimes run in isolated containers with minimal network access
- IAM roles are ephemeral and scoped to the minimum permissions needed
- All infrastructure changes go through the same CI/CD pipeline as application code

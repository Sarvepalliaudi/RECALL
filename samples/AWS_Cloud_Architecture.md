# AWS Cloud Architecture Specification & Network Topology

## Architecture Overview
This document specifies the multi-region AWS cloud infrastructure topology designed for high availability, fault tolerance, and zero-downtime disaster recovery.

```
                    +-----------------------------+
                    |     Route 53 DNS (Failover) |
                    +-----------------------------+
                                   |
         +-------------------------+-------------------------+
         |                                                   |
+------------------------+                          +------------------------+
| Region: us-east-1      |                          | Region: us-west-2 (DR) |
| VPC: 10.0.0.0/16       | <--- VPC Peering -----> | VPC: 10.1.0.0/16       |
| Public / Private AZs   |                          | Standby Recovery Stack |
+------------------------+                          +------------------------+
```

## Subnet Architecture & Routing
* **Primary Region**: `us-east-1` (US East - N. Virginia)
* **Disaster Recovery Standby**: `us-west-2` (US West - Oregon)
* **VPC Peering**: Encrypted inter-region transit peering active for database replication.
* **Public Subnets**: Host Application Load Balancers (ALBs) and NAT Gateways across Availability Zones `us-east-1a`, `us-east-1b`, and `us-east-1c`.
* **Private Application Subnets**: Isolated backend container clusters and ECS task runners.
* **Database Subnets**: Multi-AZ Amazon RDS PostgreSQL cluster with cross-region read replica in `us-west-2`.

## Disaster Recovery Objectives
* **Recovery Time Objective (RTO)**: 15 minutes automated DNS failover via Amazon Route 53 health probes.
* **Recovery Point Objective (RPO)**: < 1 minute asynchronous cross-region WAL replication.
* **CloudWatch Alarms**: Automated SNS alerts triggered on HTTP 5xx spikes or unauthenticated access attempts.

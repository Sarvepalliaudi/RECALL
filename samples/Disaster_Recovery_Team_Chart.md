# Disaster Recovery Incident Command & Team Organizational Chart

## Incident Command Structure (ICS)
In the event of a tier-1 system failure, data center outage, or regional catastrophe, the Disaster Recovery Command Team takes operational control of engineering resources.

| Role | Primary Contact | Secondary Contact | Key Responsibility |
| :--- | :--- | :--- | :--- |
| **Incident Commander** | VP of Infrastructure | Lead SRE | Coordinates all active failover teams; authorizes regional failover. |
| **Database Lead** | Lead DBA | Senior Storage Engineer | Validates point-in-time recovery, initiates replica promotion. |
| **Network & Security Lead** | Chief Security Officer | Senior Network Architect | Re-routes DNS, monitors edge firewall, isolates compromised networks. |
| **Communications Officer** | Head of Product | Customer Success Lead | Posts status updates, briefs enterprise clients, manages internal comms. |

## Failover Sequence Checklist
1. Verify loss of primary data center heartbeat in `us-east-1` (minimum 3 failed probes across 180 seconds).
2. Incident Commander convenes emergency war room on dedicated bridge.
3. Promote standby PostgreSQL read replica in `us-west-2` to primary read/write instance.
4. Update Route 53 DNS weighted alias records to route 100% traffic to Oregon standby cluster.
5. SRE team executes smoke tests across authentication, payment gateways, and search indexes.
6. Declare recovery complete and issue post-incident root cause analysis (RCA) within 24 hours.

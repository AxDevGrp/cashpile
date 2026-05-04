# Multi-Factor Authentication for Critical Systems

**Company:** Cashpile  
**Document Date:** April 26, 2026  
**Version:** 1.0  
**Purpose:** Response to Plaid security review question regarding MFA for systems that store or process consumer financial data

---

## Response Summary

**Assumption for this document:** Cashpile has enabled and requires multi-factor authentication for administrator and privileged-user access to critical systems that store or process consumer financial data.

Under that assumption, Cashpile's response is:

> Yes. Multi-factor authentication (MFA) is required for access to critical systems that store or process consumer financial data. MFA applies to administrator and privileged-user access for infrastructure, database administration, source control, and third-party vendor platforms used in the delivery and operation of the Cashpile product.

If that assumption is not fully accurate, use the alternate wording in **Appendix A** instead of this document's summary statement.

---

## 1. Scope

This document covers administrative and privileged access to systems used to host, store, process, deploy, monitor, or administer consumer financial data and related production assets.

### In-Scope Critical Systems

- **Supabase** — database platform storing financial account and transaction data
- **Railway** — production application hosting and environment secret management
- **GitHub** — source control and deployment workflow access
- **Plaid Dashboard** — Plaid configuration and production credential management
- **Administrative email and identity accounts** tied to password resets, alerts, and production access

---

## 2. MFA Control Requirement

Cashpile requires multi-factor authentication for access to critical systems by employees, contractors, or administrators with privileged access.

### Control Objective

- Prevent unauthorized access to systems containing consumer financial data
- Reduce the risk of account compromise from password theft or reuse
- Add a second factor before privileged access is granted to production systems

### Covered Access Types

- Administrator access
- Owner access
- Maintainer access
- Production deployment access
- Secrets management access
- Database administration access

---

## 3. MFA Enforcement by System

| System | Access Type | MFA Requirement |
|--------|-------------|-----------------|
| Supabase | Admin console, database administration | Required |
| Railway | Production hosting dashboard, environment configuration | Required |
| GitHub | Repository administration, deployment-related access | Required |
| Plaid Dashboard | Production Plaid configuration and credentials | Required |
| Admin email/identity provider | Accounts supporting resets and alerts | Required |

---

## 4. Additional Access Controls

MFA is part of a broader access control program that includes:

- **Least privilege access** to production systems
- **Role-based access controls** where supported by the vendor platform
- **Restricted distribution of production credentials**
- **Environment-based separation** between development and production
- **Use of server-side secrets only** for privileged keys such as Plaid and Supabase service credentials
- **Authenticated access to internal application routes and admin workflows**

---

## 5. Consumer Financial Data Protection Context

The following categories of data are treated as sensitive and protected by the systems listed above:

- Plaid access tokens
- Linked financial account identifiers
- Transaction history
- Account balances
- Internal production environment secrets used to process financial data

MFA is required for privileged access to systems that can directly or indirectly expose, modify, or administer these data types.

---

## 6. Evidence Maintained Internally

Cashpile can support this statement with administrative evidence maintained in vendor platforms, including:

- Account security settings showing MFA enabled
- Organization security policies requiring MFA
- Access management screenshots or configuration exports
- Vendor audit logs showing privileged login events

---

## 7. Review and Maintenance

This document should be reviewed whenever:

- A new production vendor is added
- Access control requirements change
- MFA enforcement changes for any in-scope system
- Plaid requests updated security documentation

---

## Appendix A: Alternate Statement If MFA Is Not Fully Enforced

If MFA is not yet required across all critical systems, use this statement instead:

> MFA is enabled for some critical systems but is not yet universally enforced across all systems that store or process consumer financial data. Access is currently restricted through authenticated accounts, limited administrative access, and least-privilege permissions. Full MFA enforcement for all critical systems is being completed as part of Cashpile's security hardening process.

This appendix should **not** be uploaded in place of the main statement unless it accurately reflects current practice.

---

## Document Control

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | April 26, 2026 | Initial draft for Plaid documentation |

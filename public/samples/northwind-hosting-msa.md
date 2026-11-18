> **Sample document.** Fictional parties and terms, written to demonstrate Clausemap. This is not a real agreement.

# Master Services Agreement

**Agreement No.** MSA-2026-014 · **Effective Date:** March 1, 2026

This Master Services Agreement (the "Agreement") is entered into between **Contoso Financial Group, Inc.**, a Delaware corporation ("Customer"), and **Northwind Cloud Hosting, Inc.**, a Washington corporation ("Supplier").

## 1. Definitions

**1.1 "Available"** means the production instance of the Hosted Services is reachable over the public internet and responds to synthetic transactions within five seconds.

**1.2 "Business Day"** means a day other than a Saturday, Sunday or public holiday in New York, New York.

**1.3 "Hosted Services"** means the managed application hosting, database and storage services described in each Order Form.

**1.4 "Incident"** means an unplanned interruption to, or reduction in the quality of, the Hosted Services. A "Severity 1 Incident" is an Incident that makes the Hosted Services unavailable or materially unusable for all users.

**1.5 "Scheduled Maintenance"** means planned work on the Hosted Services performed during the maintenance window agreed in the Order Form.

## 2. Term

**2.1 Term.** This Agreement commences on the Effective Date and continues for an initial term of thirty-six (36) months, after which it renews for successive twelve (12) month periods unless either party gives notice of non-renewal at least ninety (90) days before the end of the then-current term.

## 3. Services

**3.1 Scope.** Supplier shall provide the Hosted Services described in each Order Form in accordance with this Agreement.

**3.2 Service Delivery Manager.** Supplier shall assign a named Service Delivery Manager who is responsible for the overall performance of the Hosted Services and who attends governance meetings with Customer.

## 4. Service Levels

**4.1 General.** Supplier shall meet the Service Levels set out in this Section 4 and in Schedule B.

**4.2 Availability.** Supplier shall ensure the Hosted Services are Available at least 99.9% of each calendar month, excluding Scheduled Maintenance notified no less than five (5) Business Days in advance.

**4.3 Measurement.** Availability is calculated as the minutes in the month during which the Hosted Services were Available, divided by the total minutes in the month less Scheduled Maintenance, expressed as a percentage. Supplier measures Availability with synthetic monitoring at one-minute intervals.

**4.4 Service Credits.** Where Availability falls below the Service Level in any calendar month, Supplier shall issue a Service Credit to Customer within thirty (30) days after the end of that month, calculated in accordance with Schedule C.

**4.5 Chronic Failure.** If Availability falls below 99.0% in any three months within a rolling twelve-month period, Customer may terminate the affected Order Form without penalty.

## 5. Fees and Payment

**5.1 Fees.** Customer shall pay the fees set out in each Order Form.

**5.2 Invoicing.** Supplier invoices monthly in arrears. Customer shall pay undisputed invoices within forty-five (45) days of receipt.

## 6. Customer Responsibilities

**6.1 Incident Notification.** Customer reports Incidents through Supplier's service desk portal or its 24x7 telephone line.

## 7. Reporting and Governance

**7.1 Monthly Service Report.** Supplier shall deliver to Customer a Monthly Service Report no later than the tenth (10th) Business Day of each month, covering Availability, Incident volumes, Incident response and resolution times, and Service Credits for the preceding month.

**7.2 Quarterly Business Review.** The parties shall hold a Quarterly Business Review within twenty (20) Business Days after the end of each calendar quarter.

## 8. Confidentiality

**8.1 Protection.** Each party shall protect the other party's Confidential Information using at least the degree of care it uses to protect its own, and no less than reasonable care.

## 9. Security and Compliance

**9.1 Security Program.** Supplier shall maintain an information security program aligned to ISO/IEC 27001.

**9.2 Security Incidents.** Supplier shall notify Customer of any Security Incident affecting Customer Data without undue delay and in any event within twenty-four (24) hours of becoming aware of it.

**9.3 Assurance Reports.** Supplier shall deliver a SOC 2 Type II report annually and a bridge letter within thirty (30) days after the end of each calendar quarter.

**9.4 Penetration Testing.** Supplier shall engage an independent third party to perform a penetration test of the Hosted Services at least annually and shall provide Customer with an executive summary of the results.

**9.5 Vulnerability Remediation.** Supplier shall remediate vulnerabilities rated Critical (CVSS 9.0 or higher) within fifteen (15) days and High (CVSS 7.0 to 8.9) within thirty (30) days of discovery.

## 10. Business Continuity

**10.1 Plan.** Supplier maintains a business continuity and disaster recovery plan for the Hosted Services.

**10.2 Recovery Objectives.** Supplier shall maintain a Recovery Point Objective of no more than twenty-four (24) hours and a Recovery Time Objective of no more than four (4) hours for the Hosted Services, and shall test its disaster recovery plan at least once in each calendar year.

## 11. General

**11.1 Governing Law.** This Agreement is governed by the laws of the State of New York.

**11.2 Notices.** All notices under this Agreement must be in writing and delivered to the addresses set out in the Order Form.

---

## Schedule B — Incident Management

**2.1 Severity 1 Response.** For Severity 1 Incidents, Supplier shall acknowledge and commence remediation within fifteen (15) minutes of notification, 24x7x365.

**2.2 Severity 2 Response.** For Severity 2 Incidents, Supplier shall acknowledge within one (1) hour and provide status updates every four (4) hours until resolution.

**2.3 Severity 1 Resolution.** Supplier shall resolve or provide an accepted workaround for Severity 1 Incidents within four (4) hours of notification.

## Schedule C — Service Credits

Service Credits are calculated as a percentage of the monthly fees for the affected Hosted Services:

- Availability of at least 99.5% but below 99.9%: 5% of monthly fees.
- Availability of at least 99.0% but below 99.5%: 10% of monthly fees.
- Availability below 99.0%: 25% of monthly fees.

---

*Signed for Contoso Financial Group, Inc.* — Director, Vendor Management
*Signed for Northwind Cloud Hosting, Inc.* — VP, Customer Operations

# MediLab Nexus User Manual

## Purpose

MediLab Nexus is a connected laboratory and imaging workspace for registering patients, managing diagnostic requests, running sonography workflows, issuing reports, recording expenses, managing users, and maintaining shared operational visibility across multiple computers.

This manual is written for everyday users of the software. It focuses on the live hosted system and the hosted desktop shell, where all users work against the same central PostgreSQL database.

## Documentation Set

Use these companion documents when you need a shorter or role-specific guide:

- [QUICK_START.md](QUICK_START.md)
- [ROLE_GUIDE_RECEPTION.md](ROLE_GUIDE_RECEPTION.md)
- [ROLE_GUIDE_SONOGRAPHER.md](ROLE_GUIDE_SONOGRAPHER.md)
- [ROLE_GUIDE_DOCTOR.md](ROLE_GUIDE_DOCTOR.md)
- [ROLE_GUIDE_MANAGER.md](ROLE_GUIDE_MANAGER.md)
- [ROLE_GUIDE_ADMIN.md](ROLE_GUIDE_ADMIN.md)
- [SCREENSHOT_CHECKLIST.md](SCREENSHOT_CHECKLIST.md)

## Accessing MediLab Nexus

> Screenshot placeholder: hosted sign-in page or desktop app landing screen.

You can use MediLab Nexus in either of these ways:

1. Web browser access
   Open the organization-provided MediLab Nexus URL in a modern browser.
2. Windows desktop app
   Open the installed MediLab Nexus desktop app. The desktop app loads the hosted system directly and shows the same live data as the browser version.

Use a stable internet connection. Because the system is centrally hosted, every saved change is shared with other authorized users.

## First-Time Setup

> Screenshot placeholder: Register first admin flow.

If the database is new and no user accounts exist yet, the sign-in page shows a first-run setup flow.

1. Select Register first admin.
2. Enter the first administrator's full name, username, and PIN.
3. Submit the form to create the first admin account.
4. Sign in with that new account.

Important notes:

- Usernames should be simple and consistent, for example `frontdesk1` or `admin.main`.
- PINs must be 4 to 12 characters.
- The first admin should immediately create the rest of the user accounts from User Management.

## Signing In and Security

The sign-in form uses:

- Username
- PIN

Security behavior:

- Access is role-based. Users only see pages and actions allowed for their role.
- Repeated failed sign-in attempts can lock an account temporarily.
- Users can change their own PIN after signing in.
- Administrators or authorized managers can recover another user's PIN and unlock locked accounts.

If you cannot sign in:

1. Confirm that the username is correct.
2. Re-enter the PIN carefully.
3. If you were locked out, wait or contact an administrator to unlock the account.
4. If the entire system is unavailable, contact the administrator to confirm the server is online.

## Main Navigation

> Screenshot placeholder: sidebar showing Dashboard, Patients, Sonography Worklist, Scan Reports, Alerts, and Settings.

The main menu is role-aware. Depending on your role, you may see some or all of these sections:

- Dashboard
- Patients
- Patient Records
- Lab Reports
- Sonography Worklist
- Scan Reports
- Operations Report
- Expenses
- Services
- Audit Logs
- User Management
- Alerts
- Settings

The most important roles are optimized around these portals:

- Receptionist portal: registration, service lookup, expenses, report pickup
- Sonographer portal: worklist, scan progress, draft handoff
- Doctor portal: interpretation and scan reporting
- Manager portal: operations, reports, users, alerts, settings
- Admin portal: full system control

Some roles such as Finance, QA, Lab Tech, Phlebotomist, and Radiologist may use the same shared screens, but their available actions depend on the permissions assigned to their account.

## Dashboard

The Dashboard is the operational home page.

Use it to:

- See queue pressure and open work
- Watch current scan and reporting activity
- Review recent patients
- Monitor critical alerts and pending follow-up items
- Check high-level revenue and outstanding balance indicators where your role allows it

Best practice: begin each shift on Dashboard so you can see what already needs attention.

## Patients

> Screenshot placeholder: patient registration form with Trace Code and contact details.

The Patients page is the main intake area for patient registration and front-desk workflow.

### Registering a New Patient

Enter the patient's details such as:

- First name
- Last name
- Middle name if available
- Phone number
- Date of birth if available
- Gender
- Location
- NHIS ID if available
- Allergies if relevant
- Referral doctor or referral name if applicable
- Consent status

After registration, the system assigns or confirms a Patient Trace Code.

### Trace Code Rule

Patient Trace Codes must remain in this format:

- initials + sequential number
- example: `AM1214`

Use the Trace Code whenever searching for a patient, attaching work, taking payment, or printing records.

### Front-Desk Intake

From Patients, reception staff can also:

- Attach the required diagnostic service
- Start intake for a scan request
- Capture payer details
- Collect an immediate payment when applicable

Best practice: confirm the patient's phone number and Trace Code before finishing intake.

## Patient Records

> Screenshot placeholder: patient records search and history view.

Patient Records is used to review a patient's history after registration.

Use this page to:

- Search patients by name or Trace Code
- Review patient details
- View previous workflow activity
- Reprint patient records
- Review payment and receipt history
- Edit patient profile details where your permissions allow it

This page is especially useful for returning patients and for follow-up visits.

Diagnostic requests are now started from Patients and related workflow pages instead of a separate Orders & Requests page. Staff should attach the correct service during intake, then continue the case from Patient Records, Sonography Worklist, Lab Reports, or Scan Reports depending on the study type.

## Sonography Worklist

> Screenshot placeholder: sonography queue with appointment status controls.

Sonography Worklist is the central page for imaging flow.

Use it to:

- See scheduled studies
- Track arrivals
- Move patients into scanning
- Record sonographer and reviewer names
- Mark work as reported or completed when the scan is ready for interpretation or handoff
- Flag critical studies where necessary

Typical appointment states include:

- Scheduled
- Arrived
- Scanning
- Reported
- Completed
- Cancelled

Recommended sonography flow:

1. Open Sonography Worklist at the start of the shift.
2. Confirm the next patient by Trace Code and name.
3. Update status as the patient arrives and scanning begins.
4. Enter the sonographer's name and related study notes.
5. Hand off to the doctor or reporting user once the study is ready.

## Lab Reports and Scan Reports

> Screenshot placeholder: single-document report editor with template actions and preview.

Lab Reports and Scan Reports are used to draft, review, preview, and print final diagnostic reports.

Use it to:

- Select the patient and related order
- Enter the report title
- Write the full report inside one report document editor
- Load a saved template or import a template from drive
- Import `.docx`, PDF, HTML, or plain-text templates
- Mark critical findings
- Preview the report before release
- Print or release the final report

The system supports ultrasound-oriented structured templates such as:

- General ultrasound
- Abdominal ultrasound
- Pelvic ultrasound
- Obstetric ultrasound
- Echocardiography

Recommended reporting flow:

1. Confirm the correct patient and order.
2. Load a saved template or import a file if the report should follow a standard layout.
3. Type or paste the full narrative into the single report document, including history, findings, measurements, and impression where appropriate.
4. Preview the report.
5. Release the report only after clinical review is complete.

Reception users should only preview or print reports after the reporting clinician has finalized them.

Template import notes:

- Word `.docx` templates preserve document structure best.
- PDF templates can be uploaded and mapped into the report document when the PDF text is readable.
- Older `.doc` files should be re-saved as `.docx` before upload.

## Printing and Previews

MediLab Nexus supports printable previews for:

- Reports
- Receipts
- Invoices
- Patient records
- Operations reports

If nothing opens when you try to preview or print, allow pop-ups for the MediLab Nexus site in your browser.

## Expenses

> Screenshot placeholder: expense entry form and expense filters.

The Expenses page is for operational spending and refund tracking.

Use it to:

- Record daily expenses
- Categorize expenses
- Enter descriptions and amounts
- Record who captured the expense
- Filter expenses by category and date
- Review recent spending totals

Patient refunds are also tracked through this area so the financial record remains complete.

Best practice: record expenses on the same day they happen.

## Services

> Screenshot placeholder: service catalog with pricing and turnaround settings.

The Services page manages the catalog of tests and imaging services offered by the facility.

Use it to:

- Add a new service
- Edit service name and code
- Set whether it is a test or imaging service
- Maintain pricing
- Set turnaround time using days, hours, and minutes
- Mark services active or inactive

Bulk import support is available for service setup. When using bulk import, check the preview carefully before confirming changes. Turnaround values can be entered as total minutes or combined values such as `1d 2h 30m`.

Only authorized users should change pricing or deactivate services.

## Operations Report

> Screenshot placeholder: operations report summary cards and trend charts.

Operations Report is the main management and finance reporting page.

Use it to review:

- Collections
- Outstanding balances
- Expenses
- Net operational performance
- Payment method mix
- Employee discount activity where that payment method has been used
- Claim status mix
- Top services
- Study performance trends
- Top referrers
- User performance summaries

Range filters can be used for:

- Today
- Yesterday
- 7 days
- 30 days
- Custom range
- All time

Managers and finance users should use this page daily to monitor revenue, cost, and workflow pressure.

## Alerts

> Screenshot placeholder: internal bell composer and queued notifications list.

The Alerts page supports internal operational communication and outbound notification review.

### Internal Bell

Use the internal bell to call another user quickly.

1. Choose the recipient.
2. Type a short message.
3. Select Send bell.

Users can dismiss alerts after reading them.

### Notification Queue

Authorized users can also review queued outbound notices such as:

- SMS
- Email
- WhatsApp

This is useful for checking whether important messages are still queued, sent, or failed.

## User Management

> Screenshot placeholder: user table with Add user, Recover PIN, and Unlock actions.

User Management is for administrators and other authorized supervisors.

Use it to:

- Create new user accounts
- Assign roles
- Activate or deactivate accounts
- Recover a user's PIN
- Unlock locked accounts
- Change your own PIN
- Search and filter users by role or account state

### Creating a User

When creating a user, enter:

- Username
- Display name
- Role
- Initial PIN

Share the initial PIN securely, then ask the user to change it after first sign-in.

Visible user counts in this page depend on the signed-in facility. If users are missing, refresh the page and confirm you are signed into the correct facility workspace.

## Settings

> Screenshot placeholder: facility profile and backup controls.

The Settings page contains facility profile and system operations tools.

### Facility Profile

Authorized users can maintain:

- Facility name
- Phone number
- Email
- Location
- Logo
- Report and receipt footer message
- Printable font size

These details appear on printed materials such as receipts and diagnostic reports.

### System Operations

Depending on permissions, Settings also allows:

- Create backup
- Export backup
- Import backup
- Restore backup
- Run dispatch

Backup snapshots should be exported to a safe external location if long-term retention is required.

## Audit Logs

> Screenshot placeholder: audit log filters and event table.

Audit Logs records important system actions.

Use it to:

- Search by action, summary, Trace Code, or role
- Confirm what happened and when
- Review who performed an action

This page is especially important for compliance review, internal investigations, and tracing sensitive operational changes.

## Recommended Daily Workflows

### Receptionist

1. Sign in and open Dashboard.
2. Register the patient in Patients.
3. Confirm or note the Trace Code.
4. Attach the correct service.
5. Capture payer details and payment if required.
6. Direct the patient to the next care point.
7. Later, use Scan Reports to preview or print finalized reports for pickup.

### Sonographer

1. Start in Sonography Worklist.
2. Update study status as patients arrive.
3. Record scan progress and bench ownership.
4. Draft or prepare reporting handoff.
5. Escalate critical findings promptly.

### Doctor or Reporting Specialist

1. Review the reading queue from Sonography Worklist.
2. Open Scan Reports.
3. Complete findings and impression.
4. Preview the report.
5. Release only when satisfied with the final content.

### Manager

1. Check Dashboard first.
2. Review Operations Report.
3. Monitor expenses and outstanding balances.
4. Review user, alert, and report activity.
5. Confirm settings and service configuration remain accurate.

### Administrator

1. Review Dashboard and Alerts.
2. Maintain users and permissions.
3. Monitor audit logs.
4. Manage backups and dispatch controls from Settings.
5. Keep facility profile and core service configuration current.

## Good Operating Practices

- Always search before creating a new patient to avoid duplicates.
- Always confirm the Trace Code during phone, billing, and report handoff interactions.
- Do not release reports before clinical review is complete.
- Record expenses, refunds, and payments on the same day.
- Change shared or temporary PINs immediately.
- Export important backups to a secure external location.
- Use role-appropriate accounts instead of sharing one login among multiple staff.

## Troubleshooting

### I cannot sign in

- Check the username spelling.
- Confirm the PIN.
- Ask an admin to unlock or recover the account if necessary.

### The preview or print window does not open

- Allow pop-ups for the MediLab Nexus site.
- Try the action again.

### Another user cannot see my changes

- Confirm both users are connected to the hosted system.
- Refresh the page or reopen the desktop app.
- If the issue continues, ask an admin to check server availability.

### I cannot find a patient

- Search by Trace Code first.
- Then search by phone number or name.
- Check whether the patient may have been registered under a slightly different spelling.

### A report should not be handed to the patient yet

- Confirm the report status with the responsible doctor or reporting user.
- Use preview only until the report is finalized and released.

## Administrator Handover Checklist

Before going live with a new facility, confirm that:

1. The first admin account has been created.
2. All required staff accounts and roles have been added.
3. Facility profile details are correct.
4. Core services and pricing are loaded.
5. Staff understand the Trace Code workflow.
6. Backup export procedures are agreed and tested.
7. Users know which portal pages belong to their role.

## Final Reminder

MediLab Nexus is a shared live system. Enter patient, reporting, and financial data carefully because your actions affect the full team immediately.
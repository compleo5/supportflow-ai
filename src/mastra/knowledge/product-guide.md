# SupportFlow — Product Guide

## Getting Started

### Creating Your First Project
1. Log in to your SupportFlow dashboard.
2. Click "New Project" in the top-right corner.
3. Enter a project name and optional description.
4. Choose a template (Blank, Kanban, Scrum, or Custom).
5. Invite team members by email.
6. Your project is ready — start creating tasks.

### Dashboard Overview
The dashboard shows all your active projects at a glance. Key sections:
- **My Tasks**: Tasks assigned to you across all projects.
- **Recent Activity**: Latest updates from your team.
- **Notifications**: Mentions, due dates, and status changes.
- **Quick Actions**: Shortcuts to create tasks, schedule meetings, or invite members.

### Navigation
- **Projects**: View and manage all projects.
- **Calendar**: See tasks and deadlines in calendar view.
- **Reports**: Access analytics and performance reports.
- **Settings**: Manage account, billing, integrations, and team.

## Core Features

### Task Management
Create tasks with titles, descriptions, due dates, priorities (Low, Medium, High, Critical), and assignees. Tasks support:
- **Subtasks**: Break down work into smaller pieces.
- **Labels**: Categorize with custom color-coded labels.
- **Attachments**: Upload files up to 100MB per attachment.
- **Comments**: Discuss tasks with @mentions and rich text.
- **Time Tracking**: Log hours directly on tasks (Professional+ plans).

### Team Collaboration
- **Real-time editing**: Multiple users can edit task descriptions simultaneously.
- **@Mentions**: Tag team members in comments to notify them.
- **Activity Feed**: See who did what and when on every task.
- **File Sharing**: Share files within tasks or in the project file library.

### Automations
Set up rules to automate repetitive work:
- When a task status changes to "Done", notify the project owner.
- When a task is overdue by 2 days, escalate priority to High.
- When a new team member is added, assign onboarding tasks automatically.
- Custom automations via webhooks and Zapier (Professional+ plans).

### Reporting & Analytics
- **Burndown Charts**: Track sprint progress.
- **Velocity Reports**: Measure team throughput over time.
- **Time Reports**: Analyze hours logged by team member, project, or label.
- **Custom Dashboards**: Build dashboards with widgets for any metric.
- Reports can be exported as PDF or CSV.

## Advanced Features

### API Access
The SupportFlow REST API allows you to programmatically manage projects, tasks, and users. Available on Professional and Enterprise plans.
- Base URL: `https://api.supportflow.io/v1`
- Authentication: Bearer token (generate in Settings > API Keys)
- Rate limits: 1,000 req/hr (Professional), configurable (Enterprise)
- Full API documentation: `https://docs.supportflow.io/api`

### Webhooks
Receive HTTP POST notifications when events occur:
- Task created, updated, or deleted
- Comment added
- Team member added or removed
- Project archived
Configure webhooks in Settings > Integrations > Webhooks.

### Single Sign-On (SSO)
Enterprise plans support SAML 2.0 SSO with providers including Okta, Azure AD, Google Workspace, and OneLogin. Contact your account manager for configuration.

## Mobile App
SupportFlow is available on iOS (14+) and Android (11+). Features include:
- View and manage tasks
- Receive push notifications
- Take photos and attach directly to tasks
- Offline mode with automatic sync
Download from the App Store or Google Play.

## System Requirements
- **Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: iOS 14+ or Android 11+
- **Internet**: Minimum 1 Mbps connection
- **Screen**: Minimum 1024x768 resolution

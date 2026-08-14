# SupportFlow — Troubleshooting Guide

## Login Issues

### "Invalid credentials" error
1. Verify you're using the correct email address (check for typos).
2. Use "Forgot Password" to reset your password.
3. Clear your browser cache and cookies.
4. Try an incognito/private browser window.
5. If using SSO, ensure you're clicking "Sign in with SSO" instead of entering a password.

### "Account locked" message
Your account is locked after 5 failed login attempts within 15 minutes.
- Wait 30 minutes and try again.
- Use "Forgot Password" to reset credentials.
- Contact support if you suspect unauthorized access.

### Two-factor authentication not working
1. Ensure your authenticator app's time is synced (Settings > Time Correction in most authenticator apps).
2. Try using a backup code (provided when you set up 2FA).
3. If you've lost access to your authenticator, contact support with your account email and a government-issued ID for verification.

## Performance Issues

### Dashboard loading slowly
1. Check your internet connection speed (minimum 1 Mbps required).
2. Clear browser cache: Settings > Privacy > Clear Browsing Data.
3. Disable browser extensions that may interfere (ad blockers, VPNs).
4. Try a different browser (we recommend Chrome or Firefox).
5. If the issue persists, check our status page at status.supportflow.io.

### File uploads failing
1. Verify the file is under 100MB.
2. Check supported file formats: PDF, DOCX, XLSX, PPTX, PNG, JPG, GIF, MP4, ZIP.
3. Ensure you have remaining storage quota (Settings > Account > Storage).
4. Try uploading from a different browser.
5. For large files, use a stable wired connection instead of WiFi.

### Real-time collaboration not syncing
1. Refresh the page (Ctrl+R / Cmd+R).
2. Check that you have a stable internet connection.
3. Ensure no firewall is blocking WebSocket connections to *.supportflow.io.
4. Try disabling your VPN temporarily.
5. If multiple users are affected, check status.supportflow.io for service incidents.

## Integration Issues

### Slack integration not sending notifications
1. Verify the integration is still connected (Settings > Integrations > Slack).
2. Check that the Slack channel exists and the SupportFlow bot is a member.
3. Review notification settings — ensure the relevant events are enabled.
4. Disconnect and reconnect the integration.
5. Check Slack's own service status at status.slack.com.

### Jira sync not working
1. Verify your Jira API token hasn't expired (Settings > Integrations > Jira).
2. Ensure the Jira project still exists and you have access.
3. Check field mapping configuration — required Jira fields must be mapped.
4. Review sync logs in Settings > Integrations > Jira > Sync History.
5. Reconnect the integration if the issue persists.

### Webhook deliveries failing
1. Check that your endpoint URL is accessible from the internet.
2. Verify your endpoint returns a 2xx status code within 30 seconds.
3. Review failed deliveries in Settings > Integrations > Webhooks > Delivery Log.
4. Ensure your endpoint accepts POST requests with JSON content-type.
5. Check if your server's firewall allows connections from our IP ranges (listed in docs).

## Mobile App Issues

### App crashing on startup
1. Force-close the app and reopen it.
2. Update to the latest version from the App Store / Google Play.
3. Restart your device.
4. If the issue persists, uninstall and reinstall the app.
5. Check that your device meets minimum requirements (iOS 14+ / Android 11+).

### Push notifications not working
1. Ensure notifications are enabled in your device settings for SupportFlow.
2. Check in-app notification preferences (Settings > Notifications).
3. Verify you're logged into the correct account.
4. On Android, ensure the app is not in "Battery Optimization" mode.
5. Uninstall and reinstall if notifications still don't work.

### Offline mode not syncing
1. Connect to a stable internet connection.
2. Open the app and wait 2-3 minutes for auto-sync.
3. If changes aren't syncing, pull down on the main screen to force a refresh.
4. Check for conflicting changes (the app will highlight conflicts for manual resolution).
5. If data appears lost, contact support — offline data is preserved locally for 30 days.

## Email Notification Issues

### Not receiving email notifications
1. Check your spam/junk folder.
2. Add noreply@supportflow.io to your email contacts/allowlist.
3. Verify your email address in Settings > Account.
4. Review notification preferences in Settings > Notifications > Email.
5. Check with your IT department if corporate email filters may be blocking our domain.

## Data & Export Issues

### Data export taking too long
1. Large exports (>1GB) can take up to 4 hours.
2. You'll receive an email with a download link when complete.
3. The download link expires after 7 days.
4. If the export fails, try exporting in smaller batches (by project or date range).
5. Contact support if exports consistently fail.

### Cannot delete project
1. Ensure you are the project owner (not just an admin).
2. Archive the project first (Projects > [Project Name] > Settings > Archive).
3. After archiving, the "Delete Permanently" option becomes available after 7 days.
4. Note: Deletion is permanent and cannot be undone.
5. All tasks, files, and comments within the project will be removed.

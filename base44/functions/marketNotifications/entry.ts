import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, notificationPrefs } = body;

    if (action === 'updatePreferences') {
      // Update user notification preferences
      await base44.auth.updateMe({
        notification_preferences: {
          enabled: notificationPrefs.enabled,
          frequency: notificationPrefs.frequency || '3x_daily',
          times: notificationPrefs.times || ['09:00', '14:00', '17:00'],
          marketTrends: notificationPrefs.marketTrends !== false,
          predictions: notificationPrefs.predictions !== false,
          assets: notificationPrefs.assets || [],
        },
      });

      return Response.json({
        success: true,
        message: 'Notification preferences updated',
      });
    }

    if (action === 'sendTest') {
      // Send test notification email
      const prefs = notificationPrefs;
      const emailBody = `
<h2>HEX6 Market Update</h2>
<p>Hello ${user.full_name || user.email},</p>
<p>This is your scheduled market trend notification from HEX6 Oracle.</p>

<h3>Current Market Analysis</h3>
<ul>
  <li><strong>Market State:</strong> Analyzing multiple assets</li>
  <li><strong>Trending Assets:</strong> BTC, ETH, SPY</li>
  <li><strong>Confidence Level:</strong> 85%</li>
</ul>

<p>Log in to HEX6 to view detailed analysis and recommendations.</p>

<hr>
<p style="font-size: 12px; color: #666;">
  You're receiving this because you enabled market notifications in your HEX6 settings.
  Manage your preferences in Settings → Notifications.
</p>
      `;

      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: 'HEX6 Market Trend Alert',
        body: emailBody,
        from_name: 'HEX6 Oracle',
      });

      return Response.json({
        success: true,
        message: 'Test notification sent to ' + user.email,
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Notification error:', error);
    return Response.json(
      { error: error.message || 'Failed to process notification' },
      { status: 500 }
    );
  }
});
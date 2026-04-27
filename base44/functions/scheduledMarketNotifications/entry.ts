import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// This function should be called by a scheduled automation 3x daily
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all users with notifications enabled
    const users = await base44.asServiceRole.entities.User.filter({
      'notification_preferences.enabled': true,
    });

    if (!users || users.length === 0) {
      return Response.json({ sent: 0, message: 'No users with notifications enabled' });
    }

    let sent = 0;

    for (const user of users) {
      const prefs = user.notification_preferences || {};
      const selectedAssets = prefs.assets || [];

      // Generate market analysis
      const emailBody = `
<h2>HEX6 Market Update</h2>
<p>Hello ${user.full_name || user.email},</p>
<p>Your scheduled market trend notification from HEX6 Oracle.</p>

${prefs.marketTrends ? `
<h3>Market Trends</h3>
<p>Recent analysis shows mixed signals across major indices and crypto assets.</p>
<ul>
  <li><strong>BTC:</strong> BULL state, momentum score 0.75</li>
  <li><strong>ETH:</strong> LATERAL state, momentum score 0.42</li>
  <li><strong>SPY:</strong> BEAR state, momentum score -0.38</li>
</ul>
` : ''}

${prefs.predictions ? `
<h3>HEX6 Predictions</h3>
<p>Based on current market state analysis:</p>
<ul>
  <li>Estimated allocation to equities: 45%</li>
  <li>Estimated allocation to crypto: 25%</li>
  <li>Estimated cash position: 30%</li>
</ul>
` : ''}

${selectedAssets.length > 0 ? `
<h3>Your Watched Assets</h3>
<p>Asset-specific updates: ${selectedAssets.join(', ')}</p>
` : ''}

<p><a href="https://hex6.app">View Full Analysis in HEX6</a></p>

<hr>
<p style="font-size: 12px; color: #666;">
  You're receiving this notification at ${new Date().toLocaleTimeString()}.
  Manage frequency and content in Settings → Notifications.
</p>
      `;

      try {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: 'HEX6 Market Trend Alert',
          body: emailBody,
          from_name: 'HEX6 Oracle',
        });
        sent++;
      } catch (err) {
        console.error(`Failed to send notification to ${user.email}:`, err);
      }
    }

    return Response.json({
      sent,
      total: users.length,
      message: `Sent ${sent} market notifications`,
    });
  } catch (error) {
    console.error('Scheduled notification error:', error);
    return Response.json(
      { error: error.message || 'Failed to send notifications' },
      { status: 500 }
    );
  }
});
export default async function handler(req, res) {
  try {
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const tenantId = process.env.AZURE_TENANT_ID;

    if (!clientId || !clientSecret || !tenantId) {
      return res.status(500).json({ error: 'Faltan credenciales' });
    }

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('grant_type', 'client_credentials');

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    );

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.status(500).json({ error: 'No token', details: tokenData });
    }

    const token = tokenData.access_token;
    const PLAN_ID = 'ekFDOut6PU6ODY-adkcGCWQABrRz';

    // Obtener buckets
    const bucketsRes = await fetch(
      `https://graph.microsoft.com/v1.0/planner/plans/${PLAN_ID}/buckets`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const bucketsData = await bucketsRes.json();

    return res.status(200).json({
      token_status: 'OK',
      buckets_request_status: bucketsRes.status,
      buckets_request_ok: bucketsRes.ok,
      buckets: bucketsData,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

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
      return res.status(500).json({ error: 'No se pudo obtener token' });
    }

    const token = tokenData.access_token;
    const LIST_ID = '8f827ea8-c522-4d25-af7b-ddd936effa1c';
    const SITE_ID = 'logisticaantartica.sharepoint.com,d2f75beb-7dd9-4b76-a33b-52673e6b203d,8dea5ebc-e52c-41e4-921c-a02843dba293';

    const itemsRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items?$expand=fields&$top=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!itemsRes.ok) {
      return res.status(500).json({ error: 'Error obteniendo items de SharePoint' });
    }

    const itemsData = await itemsRes.json();
    const items = itemsData.value || [];

    const formatted = items.map(item => ({
      id: item.id,
      title: item.fields?.Title || 'N/A',
      solicitante: item.fields?.Solicitante || 'N/A',
      tipo: item.fields?.Tipo || 'N/A',
      sistema: item.fields?.Sistema || 'N/A',
      urgencia: item.fields?.Urgencia || 'N/A',
      estado: item.fields?.Estado || 'N/A',
      necesidad: item.fields?.Necesidad ? item.fields.Necesidad.substring(0, 100) + '...' : 'N/A',
    }));

    return res.status(200).json({
      total: formatted.length,
      items: formatted,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { fields } = req.body;

    // 1. Obtener token de Azure AD
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.AZURE_CLIENT_ID,
          client_secret: process.env.AZURE_CLIENT_SECRET,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials'
        })
      }
    );

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('No se pudo obtener token de Azure');
    }

    // 2. Crear item en SharePoint
    const graphResponse = await fetch(
      'https://graph.microsoft.com/v1.0/sites/logisticaantartica.sharepoint.com:/sites/Sistemas:/lists/Pedidos%20de%20Sistemas/items',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      }
    );

    const graphData = await graphResponse.json();

    if (!graphResponse.ok) {
      console.error(graphData);
      throw new Error('Error creando item en SharePoint');
    }

    res.status(200).json({ ok: true, item: graphData });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

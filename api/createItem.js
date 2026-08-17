console.log("TENANT:", process.env.AZURE_TENANT_ID);
console.log("CLIENT:", process.env.AZURE_CLIENT_ID);
console.log("SECRET:", process.env.AZURE_CLIENT_SECRET ? "OK" : "MISSING");
export const config = {
  api: {
    bodyParser: true
  }
};

export default async function handler(req, res) {
  try {
    // Asegurar que el body se parseó correctamente
    const fields = req.body?.fields;

    if (!fields) {
      return res.status(400).json({
        error: "No llegaron los campos desde el formulario",
        bodyRecibido: req.body
      });
    }

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

    if (!tokenData.access_token) {
      return res.status(500).json({
        error: 'No se pudo obtener token de Azure',
        details: tokenData
      });
    }

    const accessToken = tokenData.access_token;

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
      return res.status(500).json({
        error: 'Error creando item en SharePoint',
        details: graphData
      });
    }

    return res.status(200).json({
      ok: true,
      item: graphData
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}

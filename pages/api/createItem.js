export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const formData = req.body?.formData;
    const attachmentLinks = req.body?.attachmentLinks || [];

    if (!formData) {
      return res.status(400).json({
        error: 'No llegaron los campos desde el formulario',
      });
    }

    // Construir el campo Necesidad con links de adjuntos si existen
    let necesidadText = formData.Necesidad || '';
    if (attachmentLinks && attachmentLinks.length > 0) {
      necesidadText += '\n\n--- ADJUNTOS ---\n';
      attachmentLinks.forEach((link, idx) => {
        necesidadText += `${idx + 1}. ${link.fileName}: ${link.webUrl}\n`;
      });
    }

    const fields = {
      Title: formData.Title,
      Tipo: formData.Tipo,
      Necesidad: necesidadText,
      MejoraEsperada: formData.MejoraEsperada || '',
      Impacto: formData.Impacto || '',
      Urgencia: formData.Urgencia,
      Justificacion: formData.Justificacion,
      Solicitante: formData.Solicitante || 'Usuario Desconocido',
      Estado: formData.Estado || 'Nuevo',
    };

    if (formData.Sistema) {
      fields.Sistema = formData.Sistema;
    }

    if (formData.Areadenegocio) {
      fields.Areadenegocio = formData.Areadenegocio;
    }

    if (formData.Fechadeentregaesperada) {
      fields.Fechadeentregaesperada = formData.Fechadeentregaesperada;
    }

    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const tenantId = process.env.AZURE_TENANT_ID;

    if (!clientId || !clientSecret || !tenantId) {
      return res.status(500).json({
        error: 'Faltan variables de entorno de Azure en Vercel',
      });
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
      return res.status(500).json({
        error: 'No se pudo obtener token de Azure',
      });
    }

    const LIST_ID = '8f827ea8-c522-4d25-af7b-ddd936effa1c';

    const siteInfoRes = await fetch(
      'https://graph.microsoft.com/v1.0/sites/logisticaantartica.sharepoint.com:/sites/Sistemas',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const siteInfo = await siteInfoRes.json();

    if (!siteInfoRes.ok) {
      return res.status(500).json({ error: 'No se pudo resolver el sitio SharePoint' });
    }

    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteInfo.id}/lists/${LIST_ID}/items`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      }
    );

    const graphData = await graphResponse.json();

    if (!graphResponse.ok) {
      return res.status(500).json({
        error: 'Error creando item en SharePoint',
        details: graphData,
      });
    }

    return res.status(200).json({ 
      ok: true, 
      item: graphData,
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

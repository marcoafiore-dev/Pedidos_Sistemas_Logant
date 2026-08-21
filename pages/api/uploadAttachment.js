export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileName, fileContent, itemId } = req.body;

    if (!fileName || !fileContent || !itemId) {
      return res.status(400).json({ error: 'Missing required fields: fileName, fileContent, itemId' });
    }

    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const tenantId = process.env.AZURE_TENANT_ID;

    if (!clientId || !clientSecret || !tenantId) {
      return res.status(500).json({ error: 'Azure credentials not configured' });
    }

    // Obtener token
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
      return res.status(500).json({ error: 'Failed to obtain Azure token', details: tokenData });
    }

    const accessToken = tokenData.access_token;

    // Resolver sitio
    const siteUrl = 'https://graph.microsoft.com/v1.0/sites/logisticaantartica.sharepoint.com:/sites/Sistemas';
    const siteRes = await fetch(siteUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const siteData = await siteRes.json();

    if (!siteRes.ok) {
      return res.status(500).json({ error: 'Failed to resolve SharePoint site', details: siteData });
    }

    const siteId = siteData.id;
    const LIST_ID = '8f827ea8-c522-4d25-af7b-ddd936effa1c';

    // Convertir base64 a buffer
    const attachmentBuffer = Buffer.from(fileContent, 'base64');

    // Endpoint para attachments (Microsoft Graph)
    // Este es el endpoint correcto para agregar attachments a items de lista
    const attachmentUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${LIST_ID}/items/${itemId}/attachments`;

    console.log(`Attempting to upload: ${fileName} to ${attachmentUrl}`);
    console.log(`File size: ${attachmentBuffer.length} bytes`);

    const attachRes = await fetch(attachmentUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
      body: attachmentBuffer,
    });

    console.log(`SharePoint response status: ${attachRes.status}`);

    if (attachRes.ok) {
      const attachmentData = await attachRes.json();
      console.log(`✓ Successfully uploaded: ${fileName}`, attachmentData);
      return res.status(200).json({ 
        ok: true, 
        fileName,
        data: attachmentData,
      });
    } else {
      const errorText = await attachRes.text();
      console.error(`✗ SharePoint API error: ${attachRes.status}`, errorText);
      
      // Intentar parsear como JSON si es posible
      let errorDetails = errorText;
      try {
        errorDetails = JSON.parse(errorText);
      } catch (e) {}

      return res.status(attachRes.status).json({ 
        error: `SharePoint attachment upload failed with status ${attachRes.status}`,
        details: errorDetails,
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}

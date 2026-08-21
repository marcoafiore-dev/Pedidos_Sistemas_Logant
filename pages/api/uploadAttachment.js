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

    if (!fileName || !fileContent) {
      return res.status(400).json({ error: 'Missing fileName or fileContent' });
    }

    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const tenantId = process.env.AZURE_TENANT_ID;

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
      return res.status(500).json({ error: 'Failed to get token' });
    }

    const accessToken = tokenData.access_token;

    // Resolver sitio
    const siteRes = await fetch(
      'https://graph.microsoft.com/v1.0/sites/logisticaantartica.sharepoint.com:/sites/Sistemas',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const siteData = await siteRes.json();
    const siteId = siteData.id;

    // Obtener drive
    const driveRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const driveData = await driveRes.json();
    const driveId = driveData.id;

    // Buscar carpeta Pedidos_Adjuntos usando ruta en lugar de búsqueda
    const adjuntosRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/Pedidos_Adjuntos`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!adjuntosRes.ok) {
      console.error('Pedidos_Adjuntos folder not found at root');
      return res.status(400).json({ 
        error: 'Pedidos_Adjuntos folder not found in drive root',
      });
    }

    const adjuntosData = await adjuntosRes.json();
    const adjuntosFolderId = adjuntosData.id;

    // Subir archivo DIRECTAMENTE a Pedidos_Adjuntos (sin subcarpeta)
    const uniqueFileName = `Item_${itemId}_${Date.now()}_${fileName}`;
    const attachmentBuffer = Buffer.from(fileContent, 'base64');

    const uploadRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${adjuntosFolderId}:/${encodeURIComponent(uniqueFileName)}:/content`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
        },
        body: attachmentBuffer,
      }
    );

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      console.error('Upload failed:', errorText);
      return res.status(uploadRes.status).json({ 
        error: 'Upload failed',
        status: uploadRes.status,
        details: errorText,
      });
    }

    const uploadedFile = await uploadRes.json();

    // Generar link compartible
    const linkRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${uploadedFile.id}/createLink`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'edit',
          scope: 'organization',
        }),
      }
    );

    const linkData = await linkRes.json();
    const shareLink = linkData.link?.webUrl || uploadedFile.webUrl;

    console.log(`✓ Uploaded ${fileName} to Pedidos_Adjuntos`);

    return res.status(200).json({ 
      ok: true, 
      fileName,
      webUrl: shareLink,
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

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

    console.log(`[UPLOAD START] fileName=${fileName}, size=${fileContent.length} chars`);

    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const tenantId = process.env.AZURE_TENANT_ID;

    if (!clientId || !clientSecret || !tenantId) {
      console.error('[ERROR] Missing Azure credentials');
      return res.status(500).json({ error: 'Azure credentials not configured' });
    }

    // Obtener token
    console.log('[TOKEN] Requesting Azure token...');
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
      console.error('[ERROR] Token request failed:', tokenData);
      return res.status(500).json({ error: 'Failed to get token', details: tokenData });
    }
    console.log('[TOKEN] ✓ Token obtained');

    const accessToken = tokenData.access_token;

    // Resolver sitio
    console.log('[SITE] Resolving SharePoint site...');
    const siteRes = await fetch(
      'https://graph.microsoft.com/v1.0/sites/logisticaantartica.sharepoint.com:/sites/Sistemas',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const siteData = await siteRes.json();
    if (!siteData.id) {
      console.error('[ERROR] Site resolution failed:', siteData);
      return res.status(500).json({ error: 'Site resolution failed', details: siteData });
    }
    const siteId = siteData.id;
    console.log('[SITE] ✓ Site resolved:', siteId);

    // Obtener drive
    console.log('[DRIVE] Getting drive...');
    const driveRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const driveData = await driveRes.json();
    if (!driveData.id) {
      console.error('[ERROR] Drive resolution failed:', driveData);
      return res.status(500).json({ error: 'Drive resolution failed', details: driveData });
    }
    const driveId = driveData.id;
    console.log('[DRIVE] ✓ Drive resolved:', driveId);

    // Buscar carpeta Pedidos_Adjuntos
    console.log('[FOLDER] Looking for Pedidos_Adjuntos folder...');
    const adjuntosRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/Pedidos_Adjuntos`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    console.log('[FOLDER] Response status:', adjuntosRes.status);
    const adjuntosData = await adjuntosRes.json();
    console.log('[FOLDER] Response:', adjuntosData);

    if (!adjuntosRes.ok || !adjuntosData.id) {
      console.error('[ERROR] Pedidos_Adjuntos not found:', adjuntosData);
      return res.status(400).json({ 
        error: 'Pedidos_Adjuntos folder not found',
        details: adjuntosData,
        endpoint: `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/Pedidos_Adjuntos`,
      });
    }

    const adjuntosFolderId = adjuntosData.id;
    console.log('[FOLDER] ✓ Folder found:', adjuntosFolderId);

    // Subir archivo
    console.log('[UPLOAD] Starting file upload...');
    const uniqueFileName = `Item_${itemId}_${Date.now()}_${fileName}`;
    const attachmentBuffer = Buffer.from(fileContent, 'base64');
    
    console.log('[UPLOAD] Buffer size:', attachmentBuffer.length, 'bytes');
    console.log('[UPLOAD] Unique filename:', uniqueFileName);

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

    console.log('[UPLOAD] Response status:', uploadRes.status);
    const uploadedFile = await uploadRes.json();
    console.log('[UPLOAD] Response:', uploadedFile);

    if (!uploadRes.ok) {
      console.error('[ERROR] Upload failed:', uploadedFile);
      return res.status(uploadRes.status).json({ 
        error: 'Upload failed',
        status: uploadRes.status,
        details: uploadedFile,
      });
    }

    if (!uploadedFile.id) {
      console.error('[ERROR] No file ID in response:', uploadedFile);
      return res.status(400).json({ error: 'Upload succeeded but no file ID', details: uploadedFile });
    }

    console.log('[UPLOAD] ✓ File uploaded:', uploadedFile.id);

    // Generar link
    console.log('[LINK] Creating shareable link...');
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
    console.log('[LINK] ✓ Link created:', shareLink);

    return res.status(200).json({ 
      ok: true, 
      fileName,
      webUrl: shareLink,
    });
  } catch (error) {
    console.error('[EXCEPTION]', error);
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}

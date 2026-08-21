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
      return res.status(400).json({ error: 'Missing required fields' });
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
      return res.status(500).json({ error: 'Failed to obtain token' });
    }

    const accessToken = tokenData.access_token;

    // Resolver sitio
    const siteRes = await fetch(
      'https://graph.microsoft.com/v1.0/sites/logisticaantartica.sharepoint.com:/sites/Sistemas',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const siteData = await siteRes.json();

    if (!siteRes.ok) {
      return res.status(500).json({ error: 'Failed to resolve site', details: siteData });
    }

    const siteId = siteData.id;

    // Crear carpeta "Adjuntos" si no existe
    const drivesRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const driveData = await drivesRes.json();
    const driveId = driveData.id;

    // Buscar carpeta Adjuntos
    const folderSearchRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children?$filter=name eq 'Adjuntos'`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const folderSearchData = await folderSearchRes.json();

    let folderId;
    if (folderSearchData.value && folderSearchData.value.length > 0) {
      folderId = folderSearchData.value[0].id;
    } else {
      // Crear carpeta Adjuntos
      const createFolderRes = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/root/children`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Adjuntos',
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename',
          }),
        }
      );
      const folderData = await createFolderRes.json();
      folderId = folderData.id;
    }

    // Crear subcarpeta para este item (ID del item como nombre)
    const itemFolderRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Item_${itemId}`,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'replace',
        }),
      }
    );
    const itemFolderData = await itemFolderRes.json();
    const itemFolderId = itemFolderData.id;

    // Subir archivo
    const attachmentBuffer = Buffer.from(fileContent, 'base64');

    const uploadRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemFolderId}:/${encodeURIComponent(fileName)}:/content`,
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
      return res.status(uploadRes.status).json({ 
        error: 'Failed to upload file',
        details: errorText,
      });
    }

    const uploadedFile = await uploadRes.json();

    // Obtener URL compartible del archivo
    const createLinkRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${uploadedFile.id}/createLink`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'view',
          scope: 'organization',
        }),
      }
    );

    const linkData = await createLinkRes.json();
    const shareLink = linkData.link?.webUrl || uploadedFile.webUrl;

    return res.status(200).json({ 
      ok: true, 
      fileName,
      fileId: uploadedFile.id,
      webUrl: shareLink,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }
}
